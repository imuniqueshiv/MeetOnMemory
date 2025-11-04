import dotenv from "dotenv";
import connectDB from "./config/mongodb.js";
import { reindexAllMeetings } from "./utils/embeddingUtils.js";

dotenv.config();

const run = async () => {
  try {
    await connectDB(); // ✅ Connect to MongoDB first
    console.log("✅ Database connected for reindexing.");

    await reindexAllMeetings(); // ✅ Reindex all meetings into Pinecone
    console.log("🎉 All meetings successfully reindexed!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Reindexing failed:", error);
    process.exit(1);
  }
};

run();
