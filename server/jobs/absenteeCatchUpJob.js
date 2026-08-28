import cron from "node-cron";
import Meeting from "../models/meetingModel.js";
import AbsenteeCatchUpService from "../services/absenteeCatchUpService.js";

/**
 * Runs every hour to find recently completed meetings and trigger
 * absentee catch-up processing.
 */
export const startAbsenteeCatchUpJob = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("[Job] Running Absentee Catch-Up job...");
    try {
      // Find meetings completed in the last 24 hours that haven't been processed
      // (in a real scenario, you'd add a flag to meetingModel, e.g., absenteeProcessed: Boolean)
      // For now we just process recently completed meetings
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const meetings = await Meeting.find({
        status: "completed",
        updatedAt: { $gte: oneDayAgo },
      }).select("_id");

      for (const meeting of meetings) {
        await AbsenteeCatchUpService.processMeetingAbsentees(meeting._id);
      }
      console.log("[Job] Absentee Catch-Up job finished.");
    } catch (error) {
      console.error("[Job] Error running Absentee Catch-Up job:", error);
    }
  });
};
