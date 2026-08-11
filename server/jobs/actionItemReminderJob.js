import cron from "node-cron";
import { processActionItemReminders } from "../services/actionItemReminderService.js";

/**
 * Schedules periodic action item reminder sweeps.
 */
export const startActionItemReminderJob = () => {
  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    try {
      console.log("⏰ Running scheduled Action Item reminder job...");
      const summary = await processActionItemReminders();
      if (summary.upcomingCount > 0 || summary.overdueCount > 0) {
        console.log(
          `✅ Action Item reminders sent: ${summary.upcomingCount} upcoming, ${summary.overdueCount} overdue.`,
        );
      }
    } catch (error) {
      console.error("❌ Error in scheduled Action Item reminder job:", error);
    }
  });
};

export default startActionItemReminderJob;
