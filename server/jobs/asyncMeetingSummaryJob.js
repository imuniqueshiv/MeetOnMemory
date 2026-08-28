import cron from "node-cron";
import AsyncMeeting from "../models/asyncMeetingModel.js";
import { lockAndSummarize } from "../services/asyncMeetingService.js";

let isInitialized = false;
let asyncMeetingTask = null;

export const startAsyncMeetingSummaryJob = () => {
  if (isInitialized) {
    console.warn("⚠️ AsyncMeetingSummaryJob already initialized");
    return;
  }

  // Run every 5 minutes to check for expired deadlines
  asyncMeetingTask = cron.schedule("*/5 * * * *", async () => {
    console.log(
      "[AsyncMeetingSummaryJob] Checking for past due async meetings...",
    );
    try {
      const now = new Date();

      const meetingsToLock = await AsyncMeeting.find({
        status: "pending",
        deadline: { $lte: now },
      });

      for (const meeting of meetingsToLock) {
        try {
          console.log(
            `[AsyncMeetingSummaryJob] Locking and summarizing meeting: ${meeting._id}`,
          );
          await lockAndSummarize(meeting._id);
        } catch (err) {
          console.error(
            `[AsyncMeetingSummaryJob] Error processing meeting ${meeting._id}:`,
            err,
          );
        }
      }

      if (meetingsToLock.length > 0) {
        console.log(
          `[AsyncMeetingSummaryJob] Processed ${meetingsToLock.length} async meetings.`,
        );
      }
    } catch (err) {
      console.error("[AsyncMeetingSummaryJob] Error in job execution:", err);
    }
  });

  isInitialized = true;
  console.log("✅ AsyncMeetingSummaryJob scheduled (every 5m)");
};

export const stopAsyncMeetingSummaryJob = () => {
  if (asyncMeetingTask) {
    asyncMeetingTask.stop();
    asyncMeetingTask = null;
  }
  isInitialized = false;
  console.log("AsyncMeetingSummaryJob stopped");
};

export default startAsyncMeetingSummaryJob;
