// server/utils/aiSearchUtils.js
import { pipeline } from "@xenova/transformers";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
dotenv.config();

// 🧠 Load embedding model once (to save time)
let extractor = null;
async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Local AI model loaded");
  }
  return extractor;
}

// Generate vector from text
async function generateEmbedding(text) {
  const model = await getExtractor();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// Search in Pinecone
export async function queryAIVectorSearch(query) {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.Index(process.env.INDEX_NAME);

  const queryEmbedding = await generateEmbedding(query);
  const results = await index.query({
    vector: queryEmbedding,
    topK: 3,
    includeMetadata: true,
  });

  return results.matches.map((match) => ({
    topic: match.metadata.topic,
    score: match.score.toFixed(3),
  }));
}
