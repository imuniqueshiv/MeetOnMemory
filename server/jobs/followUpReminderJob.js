import cron from "node-cron";
import {
  processReminders,
  processOverdueTasks,
} from "../services/followUpWorkflowService.js";

/**
 * Follow-Up Reminder Job
 * Schedules periodic processing of reminders and overdue task escalations
 */

let isInitialized = false;

/**
 * Start the follow-up reminder job
 */
export const startFollowUpReminderJob = () => {
  if (isInitialized) {
    console.warn("⚠️ Follow-up reminder job already initialized");
    return;
  }

  // Process reminders every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    try {
      console.log("⏰ Running scheduled follow-up reminder job...");
      const summary = await processReminders();
      if (summary.sent > 0) {
        console.log(`✅ Sent ${summary.sent} reminders`);
      }
    } catch (error) {
      console.error("❌ Error in follow-up reminder job:", error);
    }
  });

  // Process overdue tasks every hour
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("⏰ Running scheduled overdue task processing...");
      const summary = await processOverdueTasks();
      if (summary.escalated > 0) {
        console.log(`✅ Escalated ${summary.escalated} overdue tasks`);
      }
    } catch (error) {
      console.error("❌ Error in overdue task job:", error);
    }
  });

  isInitialized = true;
  console.log("✅ Follow-up reminder jobs scheduled");
};

export default startFollowUpReminderJob;
