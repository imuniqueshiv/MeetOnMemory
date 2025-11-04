import dotenv from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config();

async function testConnection() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const index = pinecone.Index(process.env.INDEX_NAME);
    console.log("✅ Connected to Pinecone index:", process.env.INDEX_NAME);

    // Optional: list namespaces (should work even if empty)
    const stats = await index.describeIndexStats();
    console.log("📊 Index stats:", JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error("❌ Pinecone connection error:", err);
  }
}

testConnection();
