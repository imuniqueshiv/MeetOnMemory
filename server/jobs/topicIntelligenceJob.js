import Organization from "../models/organizationModel.js";
import {
  calculateWeeklyTrends,
  detectOrphanedTopics,
  buildCoOccurrenceGraph,
} from "../services/topicIntelligenceService.js";
import { queueRegistry } from "../services/queueRegistry.js";
import logger from "../utils/logger.js"; // Assume there's a logger

/**
 * Weekly job to aggregate topic data and calculate trends.
 */
export const runTopicIntelligenceJob = async () => {
  try {
    logger.info("Starting topicIntelligenceJob...");
    const orgs = await Organization.find({ status: "active" });

    for (const org of orgs) {
      try {
        await calculateWeeklyTrends(org._id);
        await detectOrphanedTopics(org._id);
        await buildCoOccurrenceGraph(org._id);
      } catch (orgErr) {
        logger.error(
          `Error running topic intelligence for org ${org._id}:`,
          orgErr,
        );
      }
    }
    logger.info("topicIntelligenceJob completed.");
  } catch (err) {
    logger.error("Error in topicIntelligenceJob:", err);
  }
};

// Assuming queueRegistry setup
export const registerTopicIntelligenceJob = () => {
  queueRegistry.registerQueue("topicIntelligence", async (_job) => {
    await runTopicIntelligenceJob();
  });

  // Weekly on Sunday at 00:00
  queueRegistry.scheduleJob(
    "topicIntelligence",
    {},
    { repeat: { cron: "0 0 * * 0" } },
  );
};
