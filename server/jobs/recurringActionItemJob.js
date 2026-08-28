import cron from "node-cron";
import { processAllRecurringActionItems } from "../services/recurringActionItemService.js";
import logger from "../utils/logger.js"; // Assuming a logger utility exists, otherwise fallback to console.

// Runs every day at midnight
const scheduleRecurringActionItemJob = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      if (logger) {
        logger.info("Starting recurring action item job...");
      } else {
        console.log("Starting recurring action item job...");
      }

      const result = await processAllRecurringActionItems(7); // Generate for the next 7 days

      if (logger) {
        logger.info(
          `Finished recurring action item job: ${JSON.stringify(result)}`,
        );
      } else {
        console.log(
          `Finished recurring action item job: ${JSON.stringify(result)}`,
        );
      }
    } catch (error) {
      if (logger) {
        logger.error("Error running recurring action item job", error);
      } else {
        console.error("Error running recurring action item job", error);
      }
    }
  });
};

export default scheduleRecurringActionItemJob;
