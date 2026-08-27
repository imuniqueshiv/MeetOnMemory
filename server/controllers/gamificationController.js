import GamificationScore from "../models/gamificationScoreModel.js";
import Badge from "../models/badgeModel.js";
import { getRedisClient } from "../services/redisService.js";
import { calculateLeaderboards } from "../jobs/leaderboardAggregationJob.js";
import { buildBadgeCatalogEntry } from "../utils/badgeCatalog.js";

export { buildBadgeCatalogEntry };

import LeaderboardEngine from "../services/leaderboardService.js";

export const getLeaderboard = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { period, team } = req.query;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: "User is not part of an organization.",
      });
    }

    if (period || team) {
      // Use dynamic engine for filtered requests
      const data = await LeaderboardEngine.getFilteredLeaderboard({
        orgId,
        period,
        team,
      });
      return res.status(200).json({ success: true, data });
    }

    // Default to cache for overall leaderboard if no filters applied
    const redis = getRedisClient();
    if (redis) {
      const cached = await redis.get(`leaderboard:org:${orgId}`);
      if (cached) {
        // Also fetch history chart dynamically since it wasn't in cache previously
        const historyData = await LeaderboardEngine.getFilteredLeaderboard({
          orgId,
          period: "all",
        });
        const data = JSON.parse(cached);
        data.historyChart = historyData.historyChart;
        return res.status(200).json({ success: true, data });
      }
    }

    // Fallback: Calculate on the fly if not cached
    await calculateLeaderboards();

    if (redis) {
      const newCached = await redis.get(`leaderboard:org:${orgId}`);
      if (newCached) {
        const historyData = await LeaderboardEngine.getFilteredLeaderboard({
          orgId,
          period: "all",
        });
        const data = JSON.parse(newCached);
        data.historyChart = historyData.historyChart;
        return res.status(200).json({ success: true, data });
      }
    }

    const dynamicData = await LeaderboardEngine.getFilteredLeaderboard({
      orgId,
      period: "all",
    });
    if (dynamicData) {
      return res.status(200).json({ success: true, data: dynamicData });
    }

    res
      .status(404)
      .json({ success: false, error: "Leaderboard data not available" });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

export const getUserScore = async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization;

    const score = await GamificationScore.findOne({
      user: userId,
      organization: orgId,
    }).populate("unlockedBadges.badge");

    res.status(200).json({
      success: true,
      data: score || { totalPoints: 0, unlockedBadges: [], history: [] },
    });
  } catch (error) {
    console.error("Error fetching user score:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

/**
 * Badge catalog with earned/locked status and progress (Issue #2066).
 */
export const getBadgesGallery = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const orgId = req.user.organization;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: "User is not part of an organization.",
      });
    }

    const [allBadges, score] = await Promise.all([
      Badge.find({}).sort({ tier: 1, name: 1 }).lean(),
      GamificationScore.findOne({
        user: userId,
        organization: orgId,
      }).lean(),
    ]);

    const badges = allBadges.map((badge) =>
      buildBadgeCatalogEntry(badge, score),
    );
    const earned = badges.filter((b) => b.earned);
    const locked = badges.filter((b) => !b.earned);
    const inProgress = locked.filter(
      (b) => b.progress.target != null && b.progress.percent > 0,
    );

    res.status(200).json({
      success: true,
      data: {
        totalPoints: score?.totalPoints || 0,
        badges,
        earned,
        locked,
        inProgress,
        summary: {
          total: badges.length,
          earnedCount: earned.length,
          lockedCount: locked.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching badges gallery:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
