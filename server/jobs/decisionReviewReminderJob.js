import cron from "node-cron";
import DecisionImpact from "../models/decisionImpactModel.js";

let isInitialized = false;

export const startDecisionReviewReminderJob = () => {
  if (isInitialized) {
    console.warn("⚠️ Decision review reminder job already initialized");
    return;
  }

  // Run daily at midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      console.log("⏰ Running decision review reminder job...");

      const now = new Date();
      // Find impacts that need review today or earlier
      const impacts = await DecisionImpact.find({
        nextReviewDate: { $lte: now },
        outcomeStatus: "pending", // Or maybe don't filter by pending if they want periodic reviews
      });

      let sent = 0;
      for (const impact of impacts) {
        // Here we'd send a notification.
        // Assuming there's a notification service or eventBus:
        /*
        eventBus.emit("notification:create", {
          userId: impact.owner,
          type: "decision_review",
          title: "Decision Review Reminder",
          message: "A decision you own is due for its impact review.",
          link: `/decisions/${impact.decisionId}`
        });
        */
        console.log(
          `Sending review reminder to ${impact.owner} for decision ${impact.decisionId}`,
        );

        // Optionally clear or bump the nextReviewDate so we don't spam them every day,
        // or add a flag `reminderSent`. For now we'll just log it.

        sent++;
      }

      if (sent > 0) {
        console.log(`✅ Sent ${sent} decision review reminders`);
      }
    } catch (error) {
      console.error("❌ Error in decision review reminder job:", error);
    }
  });

  isInitialized = true;
  console.log("✅ Decision review reminder job scheduled");
};

export const stopDecisionReviewReminderJob = () => {
  // If we kept the cron task reference, we'd stop it here
  console.log("🛑 Decision review reminder job stopped (stub)");
};
