import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import {
  getDecisions,
  getOpenActionItems,
  getDecisionLineageController,
  submitMemoryFeedback,
  updateActionItemStatus,
} from "../controllers/knowledgeController.js";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";

vi.mock("../models/decisionModel.js", () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../models/actionItemModel.js", () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock("../services/knowledgeGraphService.js", () => ({
  getDecisionLineage: vi.fn(),
}));

vi.mock("../services/importanceScoringService.js", () => ({
  recalculateAllImportanceScores: vi.fn(),
  recordMemoryAccess: vi.fn(),
  recordMemoryAccessBatch: vi.fn(),
  recordMemoryFeedback: vi.fn(),
}));

describe("knowledgeController - NoSQL Injection & Query Validation", () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { organization: "org123" },
      query: {},
      params: {},
      body: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe("getDecisions", () => {
    it("should fetch decisions with valid status and sortBy", async () => {
      req.query = { status: "open", sortBy: "importance" };

      const mockPopulate = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([{ _id: "dec1", status: "open" }]),
      });
      Decision.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getDecisions(req, res);

      expect(Decision.find).toHaveBeenCalledWith({
        organization: "org123",
        status: "open",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          decisions: [{ _id: "dec1", status: "open" }],
        }),
      );
    });

    it("should fetch all organization decisions when status is omitted", async () => {
      req.query = { sortBy: "createdAt" };

      const mockPopulate = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([{ _id: "dec1" }]),
      });
      Decision.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getDecisions(req, res);

      expect(Decision.find).toHaveBeenCalledWith({
        organization: "org123",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject NoSQL injection attack in status parameter (object filter)", async () => {
      req.query = { status: { $ne: null } };

      await getDecisions(req, res);

      expect(Decision.find).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid status",
      });
    });

    it("should reject unsupported status string value", async () => {
      req.query = { status: "DROP DATABASE" };

      await getDecisions(req, res);

      expect(Decision.find).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid status",
      });
    });

    it("should reject NoSQL injection attack in sortBy parameter", async () => {
      req.query = { sortBy: { $gt: "" } };

      await getDecisions(req, res);

      expect(Decision.find).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Invalid sortBy"),
        }),
      );
    });

    it("should ignore unsupported extra query parameters", async () => {
      req.query = { status: "open", sortBy: "createdAt", $where: "sleep(5000)" };

      const mockPopulate = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([{ _id: "dec1" }]),
      });
      Decision.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getDecisions(req, res);

      expect(Decision.find).toHaveBeenCalledWith({
        organization: "org123",
        status: "open",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should safely sanitize organization object payloads", async () => {
      req.user = { organization: { $ne: null } };
      req.query = { status: "open" };

      const mockPopulate = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });
      Decision.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getDecisions(req, res);

      expect(Decision.find).toHaveBeenCalledWith({
        organization: "[object Object]",
        status: "open",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getOpenActionItems", () => {
    it("should fetch action items with valid status and sortBy", async () => {
      req.query = { status: "in-progress", sortBy: "createdAt" };

      const mockPopulate = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([{ _id: "item1" }]),
      });
      ActionItem.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getOpenActionItems(req, res);

      expect(ActionItem.find).toHaveBeenCalledWith({
        organization: "org123",
        status: "in-progress",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject NoSQL injection attack in status (object value)", async () => {
      req.query = { status: { $regex: ".*" } };

      await getOpenActionItems(req, res);

      expect(ActionItem.find).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid status",
      });
    });

    it("should reject invalid sortBy type", async () => {
      req.query = { sortBy: ["createdAt"] };

      await getOpenActionItems(req, res);

      expect(ActionItem.find).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getDecisionLineageController", () => {
    it("should reject invalid decision id format or object type", async () => {
      req.params = { id: { $ne: "" } };

      await getDecisionLineageController(req, res);

      expect(Decision.findById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid decision id",
      });
    });

    it("should process valid ObjectId string", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      req.params = { id: validId };

      Decision.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await getDecisionLineageController(req, res);

      expect(Decision.findById).toHaveBeenCalledWith(
        new mongoose.Types.ObjectId(validId),
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("updateActionItemStatus", () => {
    it("should reject non-string status update", async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.body = { status: { $ne: "resolved" } };

      await updateActionItemStatus(req, res);

      expect(ActionItem.findOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should update status when valid parameters provided", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      req.params = { id: validId };
      req.body = { status: "resolved" };

      const mockSave = vi.fn().mockResolvedValue(true);
      ActionItem.findOne.mockResolvedValue({
        _id: validId,
        organization: "org123",
        status: "open",
        save: mockSave,
      });

      await updateActionItemStatus(req, res);

      expect(ActionItem.findOne).toHaveBeenCalledWith({
        _id: new mongoose.Types.ObjectId(validId),
        organization: "org123",
      });
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("submitMemoryFeedback", () => {
    it("should reject invalid memory type object parameter", async () => {
      req.params = { type: { $ne: "decision" }, id: new mongoose.Types.ObjectId().toString() };
      req.body = { rating: 5 };

      await submitMemoryFeedback(req, res);

      expect(Decision.findById).not.toHaveBeenCalled();
      expect(ActionItem.findById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should sanitize valid ObjectId for submitMemoryFeedback", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      req.params = { type: "decision", id: validId };
      req.body = { rating: 5 };

      Decision.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await submitMemoryFeedback(req, res);

      expect(Decision.findById).toHaveBeenCalledWith(
        new mongoose.Types.ObjectId(validId),
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});

