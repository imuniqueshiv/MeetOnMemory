import cron from "node-cron";
import GamificationScore from "../models/gamificationScoreModel.js";
import { getRedisClient } from "../services/redisService.js";
import Organization from "../models/organizationModel.js";

/**
 * Calculates percentile for scores within an organization
 */
export const calculateLeaderboards = async () => {
  try {
    console.log("[Leaderboard Job] Starting leaderboard aggregation...");
    const redis = getRedisClient();
    if (!redis) {
      console.warn("[Leaderboard Job] Redis not available. Skipping.");
      return;
    }

    const organizations = await Organization.find({}).select("_id");

    for (const org of organizations) {
      const orgId = org._id.toString();

      // Top 10 All Time
      const topScores = await GamificationScore.find({ organization: orgId })
        .sort({ totalPoints: -1 })
        .limit(10)
        .populate("user", "name profilePic");

      // Calculate Percentiles
      const allScores = await GamificationScore.find({ organization: orgId })
        .sort({ totalPoints: 1 }) // ascending for percentile math
        .select("user totalPoints");

      const totalUsers = allScores.length;

      const percentiles = {};
      allScores.forEach((doc, index) => {
        // Percentile = (Rank / Total) * 100
        const percentile =
          totalUsers > 1 ? Math.floor((index / (totalUsers - 1)) * 100) : 100;
        percentiles[doc.user.toString()] = percentile;
      });

      const leaderboardData = {
        top10: topScores,
        percentiles,
        updatedAt: new Date().toISOString(),
      };

      await redis.set(
        `leaderboard:org:${orgId}`,
        JSON.stringify(leaderboardData),
        {
          EX: 86400, // Expire in 24 hours
        },
      );
    }

    console.log("[Leaderboard Job] Leaderboard aggregation complete.");
  } catch (error) {
    console.error("[Leaderboard Job] Error aggregating leaderboards:", error);
  }
};

export const startLeaderboardJob = () => {
  // Run every night at midnight
  cron.schedule("0 0 * * *", async () => {
    await calculateLeaderboards();
  });
};
