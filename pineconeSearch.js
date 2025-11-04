import { pipeline } from "@xenova/transformers";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
dotenv.config();

async function generateEmbedding(text) {
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data); // Convert Float32Array → normal JS array
}

async function uploadToPinecone() {
  console.log("🚀 Generating embeddings locally and uploading to Pinecone...");

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.Index(process.env.INDEX_NAME);

  const documents = [
    {
      id: "1",
      text: "MeetOnMemory is an AI hackathon project for smart collaboration and memory-based retrieval.",
      metadata: { topic: "project" },
    },
    {
      id: "2",
      text: "Pinecone is a vector database optimized for semantic search and retrieval.",
      metadata: { topic: "vectorDB" },
    },
    {
      id: "3",
      text: "Transformers.js allows running sentence transformers locally without GPU or internet.",
      metadata: { topic: "embedding" },
    },
  ];

  const vectors = [];
  for (const doc of documents) {
    const embedding = await generateEmbedding(doc.text);
    vectors.push({
      id: doc.id,
      values: embedding,
      metadata: doc.metadata,
    });
  }

  await index.upsert(vectors);
  console.log("✅ Uploaded all embeddings to Pinecone successfully!");
}

async function queryPinecone(query) {
  console.log("🔍 Searching for:", query);

  const queryEmbedding = await generateEmbedding(query);
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.Index(process.env.INDEX_NAME);

  const results = await index.query({
    vector: queryEmbedding,
    topK: 3,
    includeMetadata: true,
  });

  console.log("📊 Query Results:");
  results.matches.forEach((match, i) => {
    console.log(`${i + 1}. ${match.metadata.topic} (Score: ${match.score.toFixed(3)})`);
  });
}

async function main() {
  await uploadToPinecone();
  await queryPinecone("What is Pinecone?");
}

main();
