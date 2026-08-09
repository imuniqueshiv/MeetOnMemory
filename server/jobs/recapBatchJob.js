import cron from "node-cron";
import User from "../models/userModel.js";
import RecapEmailService from "../services/recapEmailService.js";

const startRecapBatchJob = () => {
  // Daily job - runs at 00:00 every day
  cron.schedule("0 0 * * *", async () => {
    console.log("[RecapBatchJob] Running daily recap email batch...");
    try {
      // Find all users (in a real app we'd paginate or stream)
      const users = await User.find({}, "_id");
      for (const user of users) {
        await RecapEmailService.batchRecapsByUser(user._id, "daily");
      }
    } catch (err) {
      console.error("[RecapBatchJob] Error in daily job:", err);
    }
  });

  // Weekly job - runs at 00:00 on Sunday (0)
  cron.schedule("0 0 * * 0", async () => {
    console.log("[RecapBatchJob] Running weekly recap email batch...");
    try {
      const users = await User.find({}, "_id");
      for (const user of users) {
        await RecapEmailService.batchRecapsByUser(user._id, "weekly");
      }
    } catch (err) {
      console.error("[RecapBatchJob] Error in weekly job:", err);
    }
  });

  console.log("✅ RecapBatchJob scheduled.");
};

export default startRecapBatchJob;
