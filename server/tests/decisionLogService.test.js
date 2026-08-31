import { jest } from "@jest/globals";
import mongoose from "mongoose";

const mockFindByIdAndUpdate = jest.fn();
const mockFind = jest.fn();
const mockFindById = jest.fn();
const mockFindByIdAndDelete = jest.fn();
const mockAggregate = jest.fn();

jest.unstable_mockModule("../models/decisionLogEntryModel.js", () => ({
  default: {
    findByIdAndUpdate: (...args) => mockFindByIdAndUpdate(...args),
    find: (...args) => mockFind(...args),
    findById: (...args) => mockFindById(...args),
    findByIdAndDelete: (...args) => mockFindByIdAndDelete(...args),
    aggregate: (...args) => mockAggregate(...args),
  },
}));

const mockDecisionFindByIdAndUpdate = jest.fn();
const mockDecisionFindByIdAndDelete = jest.fn();
jest.unstable_mockModule("../models/decisionModel.js", () => ({
  default: {
    findByIdAndUpdate: (...args) => mockDecisionFindByIdAndUpdate(...args),
    findByIdAndDelete: (...args) => mockDecisionFindByIdAndDelete(...args),
  },
}));

const { default: decisionLogService } =
  await import("../services/decisionLogService.js");

describe("DecisionLogService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateOutcome", () => {
    it("should update outcome and impact assessment", async () => {
      const entryId = new mongoose.Types.ObjectId().toString();
      const mockEntry = {
        _id: entryId,
        outcome: "implemented",
        impactAssessment: "Good",
      };

      mockFindByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(mockEntry),
      });

      const result = await decisionLogService.updateOutcome(
        entryId,
        "implemented",
        "Good",
      );
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        entryId,
        { $set: { outcome: "implemented", impactAssessment: "Good" } },
        { new: true },
      );
      expect(result).toEqual(mockEntry);
    });
  });

  describe("editEntry", () => {
    it("should update entry fields and update corresponding Decision status", async () => {
      const entryId = new mongoose.Types.ObjectId().toString();
      const decisionId = new mongoose.Types.ObjectId().toString();
      const mockEntry = {
        _id: entryId,
        decisionId,
        outcome: "implemented",
        save: jest.fn().mockResolvedValue(true),
      };

      mockFindById.mockResolvedValueOnce(mockEntry);
      mockFindById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(mockEntry),
      });
      mockDecisionFindByIdAndUpdate.mockResolvedValueOnce({});

      const result = await decisionLogService.editEntry(entryId, {
        text: "New decision text",
        outcome: "implemented",
      });

      expect(mockEntry.save).toHaveBeenCalled();
      expect(mockDecisionFindByIdAndUpdate).toHaveBeenCalledWith(decisionId, {
        $set: { text: "New decision text", status: "resolved" },
      });
      expect(result).toEqual(mockEntry);
    });
  });

  describe("deleteEntry", () => {
    it("should delete entry and corresponding Decision", async () => {
      const entryId = new mongoose.Types.ObjectId().toString();
      const decisionId = new mongoose.Types.ObjectId().toString();
      const mockEntry = {
        _id: entryId,
        decisionId,
      };

      mockFindById.mockResolvedValueOnce(mockEntry);
      mockDecisionFindByIdAndDelete.mockResolvedValueOnce({});
      mockFindByIdAndDelete.mockResolvedValueOnce({});

      const result = await decisionLogService.deleteEntry(entryId);

      expect(mockFindById).toHaveBeenCalledWith(entryId);
      expect(mockDecisionFindByIdAndDelete).toHaveBeenCalledWith(decisionId);
      expect(mockFindByIdAndDelete).toHaveBeenCalledWith(entryId);
      expect(result).toBe(true);
    });
  });

  describe("exportLog", () => {
    it("should return raw JSON array or CSV string representation", async () => {
      const orgId = new mongoose.Types.ObjectId().toString();
      const mockEntries = [
        {
          _id: "entry-1",
          outcome: "implemented",
          decisionId: { text: "Resolved conflict" },
          meetingId: { title: "Sprint Sync" },
          decidedBy: { name: "John Doe" },
          reviewDate: new Date("2026-08-31T06:00:00Z"),
          tags: ["core"],
        },
      ];

      mockFind.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(mockEntries),
      });

      const csvResult = await decisionLogService.exportLog(orgId, "csv");
      expect(csvResult).toContain("Resolved conflict");
      expect(csvResult).toContain("Sprint Sync");
      expect(csvResult).toContain("John Doe");

      const jsonResult = await decisionLogService.exportLog(orgId, "json");
      expect(jsonResult).toEqual(mockEntries);
    });
  });
});
