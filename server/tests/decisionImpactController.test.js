import { jest } from "@jest/globals";
import {
  getDecisionImpact,
  updateDecisionImpact,
  getImpactReport,
} from "../controllers/decisionImpactController.js";
import DecisionImpact from "../models/decisionImpactModel.js";
import Decision from "../models/decisionModel.js";

describe("Decision Impact Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: { id: "user-123", _id: "user-123" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("getDecisionImpact", () => {
    it("should return 404 if impact record is not found", async () => {
      req.params.decisionId = "dec-1";
      DecisionImpact.findOne = jest.fn().mockResolvedValue(null);

      await getDecisionImpact(req, res, next);

      expect(DecisionImpact.findOne).toHaveBeenCalledWith({
        decisionId: "dec-1",
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Impact record not found",
      });
    });

    it("should return the impact record if found", async () => {
      req.params.decisionId = "dec-1";
      const mockImpact = {
        _id: "impact-1",
        decisionId: "dec-1",
        impactScore: 85,
      };
      DecisionImpact.findOne = jest.fn().mockResolvedValue(mockImpact);

      await getDecisionImpact(req, res, next);

      expect(res.status).not.toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockImpact);
    });

    it("should pass errors to next()", async () => {
      req.params.decisionId = "dec-1";
      const error = new Error("Database Error");
      DecisionImpact.findOne = jest.fn().mockRejectedValue(error);

      await getDecisionImpact(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateDecisionImpact", () => {
    it("should return 404 if the associated Decision is not found", async () => {
      req.params.decisionId = "dec-1";
      Decision.findById = jest.fn().mockResolvedValue(null);

      await updateDecisionImpact(req, res, next);

      expect(Decision.findById).toHaveBeenCalledWith("dec-1");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Decision not found" });
    });

    it("should upsert the impact record with all provided fields", async () => {
      req.params.decisionId = "dec-1";
      req.body = {
        outcomeStatus: "successful",
        impactScore: 90,
        evidence: ["increased revenue"],
        nextReviewDate: "2023-12-01",
      };

      Decision.findById = jest.fn().mockResolvedValue({ _id: "dec-1" });

      const mockUpdated = { _id: "impact-1", ...req.body };
      DecisionImpact.findOneAndUpdate = jest
        .fn()
        .mockResolvedValue(mockUpdated);

      await updateDecisionImpact(req, res, next);

      expect(DecisionImpact.findOneAndUpdate).toHaveBeenCalledWith(
        { decisionId: "dec-1" },
        {
          $set: {
            outcomeStatus: "successful",
            impactScore: 90,
            evidence: ["increased revenue"],
            nextReviewDate: "2023-12-01",
          },
          $setOnInsert: {
            owner: "user-123",
          },
        },
        { upsert: true, new: true },
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it("should set default values via $setOnInsert for missing fields", async () => {
      req.params.decisionId = "dec-1";
      req.body = {}; // No fields provided

      Decision.findById = jest.fn().mockResolvedValue({ _id: "dec-1" });
      DecisionImpact.findOneAndUpdate = jest
        .fn()
        .mockResolvedValue({ _id: "impact-1" });

      await updateDecisionImpact(req, res, next);

      expect(DecisionImpact.findOneAndUpdate).toHaveBeenCalledWith(
        { decisionId: "dec-1" },
        {
          $set: {},
          $setOnInsert: {
            owner: "user-123",
            outcomeStatus: "pending",
            impactScore: null,
            evidence: [],
            nextReviewDate: null,
          },
        },
        { upsert: true, new: true },
      );
    });

    it('should handle missing req.user by setting owner to "system"', async () => {
      req.user = undefined; // No user
      req.params.decisionId = "dec-1";
      req.body = {};

      Decision.findById = jest.fn().mockResolvedValue({ _id: "dec-1" });
      DecisionImpact.findOneAndUpdate = jest
        .fn()
        .mockResolvedValue({ _id: "impact-1" });

      await updateDecisionImpact(req, res, next);

      expect(DecisionImpact.findOneAndUpdate).toHaveBeenCalledWith(
        { decisionId: "dec-1" },
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({
            owner: "system",
          }),
        }),
        { upsert: true, new: true },
      );
    });

    it("should pass errors to next() during update", async () => {
      req.params.decisionId = "dec-1";
      Decision.findById = jest.fn().mockResolvedValue({ _id: "dec-1" });
      const error = new Error("Database connection failed");
      DecisionImpact.findOneAndUpdate = jest.fn().mockRejectedValue(error);

      await updateDecisionImpact(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getImpactReport", () => {
    it("should aggregate and return success rates and average impact scores", async () => {
      const mockStats = [
        { _id: "successful", count: 5, avgImpactScore: 85 },
        { _id: "pending", count: 2, avgImpactScore: null },
      ];

      DecisionImpact.aggregate = jest.fn().mockResolvedValue(mockStats);

      await getImpactReport(req, res, next);

      expect(DecisionImpact.aggregate).toHaveBeenCalledWith([
        {
          $group: {
            _id: "$outcomeStatus",
            count: { $sum: 1 },
            avgImpactScore: { $avg: "$impactScore" },
          },
        },
      ]);

      expect(res.json).toHaveBeenCalledWith(mockStats);
    });

    it("should handle empty aggregation results", async () => {
      DecisionImpact.aggregate = jest.fn().mockResolvedValue([]);

      await getImpactReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("should pass errors to next() during aggregation", async () => {
      const error = new Error("Aggregation failed");
      DecisionImpact.aggregate = jest.fn().mockRejectedValue(error);

      await getImpactReport(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
