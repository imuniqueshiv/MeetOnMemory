import mongoose from "mongoose";
import { jest } from "@jest/globals";
import LeaderboardEngine from "../services/leaderboardService.js";
import GamificationScore from "../models/gamificationScoreModel.js";

jest.mock("../models/gamificationScoreModel.js");

describe("LeaderboardEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getFilteredLeaderboard", () => {
    it("should throw error if orgId is missing", async () => {
      await expect(
        LeaderboardEngine.getFilteredLeaderboard({}),
      ).rejects.toThrow("Organization ID is required");
    });

    it("should aggregate all-time scores without filters", async () => {
      const mockAggregatedData = [
        {
          _id: "score1",
          user: "user1",
          userDetails: { _id: "user1", name: "Alice", team: "Engineering" },
          calculatedPoints: 100,
        },
        {
          _id: "score2",
          user: "user2",
          userDetails: { _id: "user2", name: "Bob", team: "Sales" },
          calculatedPoints: 50,
        },
      ];

      // Mock aggregate method for both leaderboard and history
      GamificationScore.aggregate.mockResolvedValueOnce(mockAggregatedData);
      GamificationScore.aggregate.mockResolvedValueOnce([
        { _id: "2023-10-01", dailyPoints: 10 },
        { _id: "2023-10-02", dailyPoints: 20 },
      ]);

      const result = await LeaderboardEngine.getFilteredLeaderboard({
        orgId: new mongoose.Types.ObjectId().toString(),
        period: "all",
      });

      expect(result.top10).toHaveLength(2);
      expect(result.top10[0].totalPoints).toBe(100);
      expect(result.top10[0].user.name).toBe("Alice");

      expect(result.percentiles).toBeDefined();
      expect(result.historyChart).toHaveLength(2);
      expect(GamificationScore.aggregate).toHaveBeenCalledTimes(2);
    });

    it("should apply team filter correctly in pipeline", async () => {
      GamificationScore.aggregate.mockResolvedValue([]);

      await LeaderboardEngine.getFilteredLeaderboard({
        orgId: new mongoose.Types.ObjectId().toString(),
        period: "all",
        team: "Engineering",
      });

      const callArgs = GamificationScore.aggregate.mock.calls[0][0];
      const matchTeamStage = callArgs.find(
        (stage) =>
          stage.$match && stage.$match["userDetails.team"] === "Engineering",
      );
      expect(matchTeamStage).toBeDefined();
    });

    it("should apply period filter (week) and reduce points", async () => {
      GamificationScore.aggregate.mockResolvedValue([]);

      await LeaderboardEngine.getFilteredLeaderboard({
        orgId: new mongoose.Types.ObjectId().toString(),
        period: "week",
      });

      const callArgs = GamificationScore.aggregate.mock.calls[0][0];
      const addFieldsStage = callArgs.find(
        (stage) => stage.$addFields && stage.$addFields.filteredHistory,
      );
      expect(addFieldsStage).toBeDefined();
    });

    it("should calculate percentiles accurately", async () => {
      const mockAggregatedData = [
        {
          _id: "score1",
          user: "user1",
          userDetails: { _id: "user1" },
          calculatedPoints: 100,
        },
        {
          _id: "score2",
          user: "user2",
          userDetails: { _id: "user2" },
          calculatedPoints: 80,
        },
        {
          _id: "score3",
          user: "user3",
          userDetails: { _id: "user3" },
          calculatedPoints: 60,
        },
        {
          _id: "score4",
          user: "user4",
          userDetails: { _id: "user4" },
          calculatedPoints: 40,
        },
      ];

      GamificationScore.aggregate.mockResolvedValueOnce(mockAggregatedData);
      GamificationScore.aggregate.mockResolvedValueOnce([]);

      const result = await LeaderboardEngine.getFilteredLeaderboard({
        orgId: new mongoose.Types.ObjectId().toString(),
      });

      // Expected percentiles: (rank / (total-1)) * 100
      // 40 is rank 0 -> 0%
      // 60 is rank 1 -> 33%
      // 80 is rank 2 -> 66%
      // 100 is rank 3 -> 100%
      expect(result.percentiles["user4"]).toBe(0);
      expect(result.percentiles["user3"]).toBe(33);
      expect(result.percentiles["user2"]).toBe(66);
      expect(result.percentiles["user1"]).toBe(100);
    });
  });
});
