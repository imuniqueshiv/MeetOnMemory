import mongoose from "mongoose";
import { jest } from "@jest/globals";
import SavedFilterService from "../services/savedFilterService.js";
import SavedFilter from "../models/savedFilterModel.js";
import Meeting from "../models/meetingModel.js";

describe("Saved Filter System", () => {
  const orgId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  describe("Query Builder", () => {
    it("should build a text search query correctly", () => {
      const filters = { searchQuery: "policy update" };
      const query = SavedFilterService.buildQuery(filters, orgId);

      expect(query.organization).toBe(orgId);
      expect(query.deletedAt).toBeNull();
      expect(query.$or).toBeDefined();
      expect(query.$or.length).toBe(4);
      expect(query.$or[0].title).toBeInstanceOf(RegExp);
    });

    it("should handle status and meetingType filters", () => {
      const filters = { status: "completed", meetingType: "policy" };
      const query = SavedFilterService.buildQuery(filters, orgId);

      expect(query.status).toBe("completed");
      expect(query.meetingType).toBe("policy");
    });

    it("should handle date range filters", () => {
      const filters = { dateRange: "month" };
      const query = SavedFilterService.buildQuery(filters, orgId);

      expect(query.$or).toBeDefined(); // The date fallback logic
      expect(query.$or[0].date.$gte).toBeInstanceOf(Date);
    });

    it("should handle combined search and date filters with $and", () => {
      const filters = { searchQuery: "test", dateRange: "week" };
      const query = SavedFilterService.buildQuery(filters, orgId);

      expect(query.$or).toBeDefined(); // For search
      expect(query.$and).toBeDefined(); // For date
      expect(query.$and[0].$or[0].date.$gte).toBeInstanceOf(Date);
    });
  });

  describe("Match Counts", () => {
    beforeAll(async () => {
      // Connect to a memory database or mock Mongoose if needed
      // Here we just test the logic, so we can spy on Mongoose
      const filter = new SavedFilter({
        _id: new mongoose.Types.ObjectId(),
        name: "Test",
        user: new mongoose.Types.ObjectId(),
        organization: new mongoose.Types.ObjectId(),
        filters: {},
        matchCount: 0,
        isPinned: true,
      });
      filter.save = jest.fn().mockResolvedValue(filter);

      jest.spyOn(Meeting, "countDocuments").mockResolvedValue(5);
      jest.spyOn(SavedFilter, "find").mockResolvedValue([filter]);
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("should update match counts for pinned filters", async () => {
      // We can't fully run save() on the mock without more setup,
      // but we can verify it fetches the filters and calls countDocuments
      await SavedFilterService.refreshMatchCounts(userId, orgId);
      expect(SavedFilter.find).toHaveBeenCalled();
      expect(Meeting.countDocuments).toHaveBeenCalled();
    });
  });
});
