import dotenv from "dotenv";
import connectDB from "./config/mongodb.js";

import Meeting from "./models/meetingModel.js";
import Decision from "./models/decisionModel.js";
import ActionItem from "./models/actionItemModel.js";

import {
  processStructuredMoM,
  detectResolutions,
} from "./services/knowledgeGraphService.js";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("✅ Database connected for knowledge graph backfill.");

    // Optional: Clear existing relationships so they can be regenerated
    console.log("🧹 Clearing existing relationship graph...");

    await Decision.updateMany(
      {},
      {
        $set: {
          relatesTo: [],
        },
      },
    );

    await ActionItem.updateMany(
      {},
      {
        $set: {
          relatesTo: [],
        },
      },
    );

    console.log("✅ Existing relationships cleared.");

    const meetings = await Meeting.find({
      structuredMoM: { $ne: null },
    }).sort({ date: 1 });

    console.log(`🔁 Backfilling ${meetings.length} meetings...`);

    let processed = 0;
    let failed = 0;

    for (const meeting of meetings) {
      try {
        await processStructuredMoM(meeting, meeting.structuredMoM);
        await detectResolutions(meeting, meeting.structuredMoM);

        processed++;
        console.log(
          `✅ (${processed}/${meetings.length}) Processed meeting ${meeting._id}`,
        );
      } catch (err) {
        failed++;
        console.error(
          `❌ Failed meeting ${meeting._id}:`,
          err.message,
        );
      }
    }

    console.log("\n==============================");
    console.log("🎉 Knowledge Graph Backfill Complete");
    console.log("==============================");
    console.log(`Processed : ${processed}`);
    console.log(`Failed    : ${failed}`);
    console.log("==============================");

    process.exit(0);
  } catch (error) {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  }
};

run();