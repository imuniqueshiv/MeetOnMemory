// ==============================================
// 📘 embeddingUtils.js
// Handles AI Embeddings + Pinecone Vector Search (Offline + Free)
// ==============================================

import { pipeline } from "@xenova/transformers";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import Meeting from "../models/meetingModel.js";

dotenv.config();

// ======= 🔑 Configuration =======
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.INDEX_NAME || process.env.PINECONE_INDEX;

if (!PINECONE_API_KEY) {
  console.error("❌ Missing PINECONE_API_KEY in .env");
}

// ======= 🌐 Global Singletons =======
let pineconeClient = null;
let pineconeIndex = null;
let embedder = null;

// ===================================================
// ⚙️ 1️⃣ Initialize Pinecone Client (Singleton)
// ===================================================
export const initVectorStore = async () => {
  try {
    if (!pineconeClient) {
      pineconeClient = new Pinecone({ apiKey: PINECONE_API_KEY });
      console.log("✅ Pinecone client initialized.");
    }

    if (!pineconeIndex) {
      pineconeIndex = pineconeClient.Index(PINECONE_INDEX);
      console.log(`✅ Pinecone index ready: ${PINECONE_INDEX}`);
    }

    return pineconeIndex;
  } catch (err) {
    console.error("❌ Failed to initialize Pinecone:", err);
    throw err;
  }
};

// ===================================================
// 🧠 2️⃣ Load Local Hugging Face Embedding Model
// ===================================================
async function getEmbedder() {
  if (!embedder) {
    console.log("⏳ Loading local Hugging Face model (MiniLM-L6-v2)...");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Local Hugging Face model loaded");
  }
  return embedder;
}

// ===================================================
// 🧩 3️⃣ Generate Embedding from Text
// ===================================================
export const embedText = async (text) => {
  try {
    if (!text || text.trim().length === 0) return [];
    const model = await getEmbedder();
    const output = await model(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error("❌ Local embedding creation failed:", error);
    throw new Error("Embedding creation failed");
  }
};


// ===================================================
// 💾 4️⃣ Index Meeting in Pinecone (FINAL v3-compatible)
// ===================================================
export const indexMeeting = async (meeting) => {
  try {
    const indexInstance = await initVectorStore();

    if (!meeting || !meeting.transcript) {
      console.warn("⚠️ Skipping empty meeting embedding");
      return;
    }

    // 🧠 Smart fallback data
    let title = meeting.title?.trim() || "";
    let summary = meeting.summary?.trim() || "";

    if (!title || title.toLowerCase().includes("untitled")) {
      title = meeting.transcript.split(" ").slice(0, 6).join(" ") + "...";
    }

    if (!summary || summary.length < 20) {
      summary = meeting.transcript.split(" ").slice(0, 50).join(" ") + "...";
    }

    const combinedText = `
      ${title}
      ${summary}
      ${meeting.transcript}
    `;

    const embedding = await embedText(combinedText);

    // ✅ FIXED FORMAT — direct array (Pinecone v3.x+)
    await indexInstance.upsert([
      {
        id: meeting._id.toString(),
        values: embedding,
        metadata: {
          meetingId: meeting._id.toString(),
          title,
          summary,
          transcript: meeting.transcript,
          createdAt: meeting.createdAt || new Date(),
        },
      },
    ]);

    console.log(`✅ Indexed meeting: ${title}`);
  } catch (error) {
    console.error("❌ Failed to index meeting:", error);
  }
};


// ===================================================
// 🔍 5️⃣ Perform Semantic Search via Pinecone
// ===================================================
// ===================================================
// 🔍 5️⃣ Perform Semantic Search via Pinecone (FIXED)
// ===================================================
export const searchVectorStore = async (query) => {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error("Empty query received for vector search");
    }

    const indexInstance = await initVectorStore();

    console.log("🔍 Performing Pinecone vector search for:", query);

    const queryEmbedding = await embedText(query);

    const results = await indexInstance.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    if (!results.matches?.length) {
      console.warn("⚠️ No results returned from Pinecone");
      return [];
    }

    // ✅ FIXED: Added transcript + better formatting
    const formattedResults = results.matches.map((match) => {
      const metadata = match.metadata || {};
      
      return {
        meetingId: metadata.meetingId || match.id,
        title: metadata.title || "Untitled Meeting",
        summary: metadata.summary || "No summary available.",
        transcript: metadata.transcript || "", // ✅ Added transcript
        createdAt: metadata.createdAt || null,
        similarityScore: parseFloat(match.score?.toFixed(3)) || 0,
      };
    });

    console.log("✅ Pinecone vector search results:", formattedResults);
    return formattedResults;
  } catch (error) {
    console.error("❌ Pinecone vector search error:", error);
    throw new Error("Vector search failed");
  }
};

// ===================================================
// 🚀 6️⃣ Bulk Reindex All Meetings (Manual / Script)
// ===================================================
export const reindexAllMeetings = async () => {
  try {
    const indexInstance = await initVectorStore();

    const allMeetings = await Meeting.find({
      transcript: { $exists: true, $ne: "" },
    });

    console.log(`🔁 Reindexing ${allMeetings.length} meetings into Pinecone...`);
    for (const m of allMeetings) {
      await indexMeeting(m);
    }

    console.log("🎉 Reindexing completed successfully!");
  } catch (error) {
    console.error("❌ Failed to reindex all meetings:", error);
  }
};
