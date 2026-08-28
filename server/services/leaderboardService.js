import GamificationScore from "../models/gamificationScoreModel.js";
import mongoose from "mongoose";

class LeaderboardEngine {
  /**
   * Fetch a filtered leaderboard dynamically.
   * Allows filtering by period ('all', 'month', 'week') and team (string).
   */
  async getFilteredLeaderboard({ orgId, period = "all", team = null }) {
    if (!orgId) throw new Error("Organization ID is required");

    let startDate = null;
    const now = new Date();
    if (period === "week") {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7,
      );
    } else if (period === "month") {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        now.getDate(),
      );
    }

    const matchStage = { organization: new mongoose.Types.ObjectId(orgId) };

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
    ];

    if (team) {
      pipeline.push({
        $match: { "userDetails.team": team },
      });
    }

    if (startDate) {
      pipeline.push({
        $addFields: {
          filteredHistory: {
            $filter: {
              input: "$history",
              as: "entry",
              cond: { $gte: ["$$entry.timestamp", startDate] },
            },
          },
        },
      });
      pipeline.push({
        $addFields: {
          calculatedPoints: {
            $reduce: {
              input: "$filteredHistory",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.pointsAwarded"] },
            },
          },
        },
      });
    } else {
      pipeline.push({
        $addFields: {
          calculatedPoints: "$totalPoints",
        },
      });
    }

    pipeline.push({
      $sort: { calculatedPoints: -1 },
    });

    const allScores = await GamificationScore.aggregate(pipeline);

    // Calculate percentiles and top 10
    const percentiles = {};
    const totalUsers = allScores.length;

    // Ascending sort for percentiles
    const ascendingScores = [...allScores].sort(
      (a, b) => a.calculatedPoints - b.calculatedPoints,
    );
    ascendingScores.forEach((doc, index) => {
      const percentile =
        totalUsers > 1 ? Math.floor((index / (totalUsers - 1)) * 100) : 100;
      percentiles[doc.user.toString()] = percentile;
    });

    const top10 = allScores.slice(0, 10).map((doc) => ({
      _id: doc._id,
      user: {
        _id: doc.userDetails._id,
        name: doc.userDetails.name,
        profilePic: doc.userDetails.profilePic,
        team: doc.userDetails.team,
      },
      totalPoints: doc.calculatedPoints,
    }));

    // History View (Chart Data): Let's calculate daily points for the organization/team over the last 30 days
    // This allows the frontend to show a timeline graph of gamification activity.
    const historyChartStartDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
    );
    const historyPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
    ];
    if (team) {
      historyPipeline.push({ $match: { "userDetails.team": team } });
    }
    historyPipeline.push(
      { $unwind: "$history" },
      { $match: { "history.timestamp": { $gte: historyChartStartDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$history.timestamp" },
          },
          dailyPoints: { $sum: "$history.pointsAwarded" },
        },
      },
      { $sort: { _id: 1 } },
    );

    const historyData = await GamificationScore.aggregate(historyPipeline);
    const historyChart = historyData.map((d) => ({
      date: d._id,
      points: d.dailyPoints,
    }));

    return {
      top10,
      percentiles,
      historyChart,
      updatedAt: new Date().toISOString(),
    };
  }
}

export default new LeaderboardEngine();
