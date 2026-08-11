import { describe, it, expect, beforeEach, vi as jest } from "vitest";
import mongoose from "mongoose";

jest.mock("../models/decisionModel.js", () => ({
  default: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("../models/actionItemModel.js", () => ({
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn(),
    exists: jest.fn(),
    aggregate: jest.fn(),
    populate: jest.fn(),
  },
}));

jest.mock("../models/meetingModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.mock("../models/organizationModel.js", () => ({
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock("../services/knowledgeGraphService.js", () => ({
  getDecisionLineage: jest.fn(),
  detectResolutions: jest.fn(),
  processStructuredMoM: jest.fn(),
}));

jest.mock("../services/importanceScoringService.js", () => ({
  recalculateAllImportanceScores: jest.fn(),
  recordMemoryAccess: jest.fn(),
  recordMemoryAccessBatch: jest.fn(),
  recordMemoryFeedback: jest.fn(),
}));

const {
  getDecisions,
  getOpenActionItems,
  getDecisionLineageController,
  submitMemoryFeedback,
  updateActionItemStatus,
} = await import("../controllers/knowledgeController.js");
const Decision = (await import("../models/decisionModel.js")).default;
const ActionItem = (await import("../models/actionItemModel.js")).default;
const Meeting = (await import("../models/meetingModel.js")).default;
const Organization = (await import("../models/organizationModel.js")).default;

describe("knowledgeController - NoSQL Injection & Query Validation", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: { organization: "org123" },
      query: {},
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("getDecisions", () => {
    it("should fetch decisions with valid status and sortBy", async () => {
      req.query = { status: "open", sortBy: "importance" };

      const mockPopulate = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: "dec1", status: "open" }]),
      });
      Decision.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getDecisions(req, res);

      expect(Decision.find).toHaveBeenCalledWith({
        organization: "org123",
        status: "open",
        lifecycleState: { $nin: ["archived", "expired"] },
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

      const mockPopulate = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: "dec1" }]),
      });
      Decision.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getDecisions(req, res);

      expect(Decision.find).toHaveBeenCalledWith({
        organization: "org123",
        lifecycleState: { $nin: ["archived", "expired"] },
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
      req.query = {
        status: "open",
        sortBy: "createdAt",
        $where: "sleep(5000)",
      };

      const mockPopulate = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: "dec1" }]),
      });
      Decision.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getDecisions(req, res);

      expect(Decision.find).toHaveBeenCalledWith({
        organization: "org123",
        status: "open",
        lifecycleState: { $nin: ["archived", "expired"] },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should safely sanitize organization object payloads", async () => {
      req.user = { organization: { $ne: null } };
      req.query = { status: "open" };

      const mockPopulate = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      Decision.find.mockReturnValue({
        populate: mockPopulate,
      });

      await getDecisions(req, res);

      expect(Decision.find).toHaveBeenCalledWith({
        organization: "[object Object]",
        status: "open",
        lifecycleState: { $nin: ["archived", "expired"] },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getOpenActionItems", () => {
    const mockFindChain = (items = [{ _id: "item1" }]) => {
      const chain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(items),
      };
      ActionItem.find.mockReturnValue(chain);
      return chain;
    };

    beforeEach(() => {
      ActionItem.countDocuments.mockResolvedValue(1);
      ActionItem.distinct.mockResolvedValue([]);
      ActionItem.exists.mockResolvedValue(null);
      Organization.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });
      Meeting.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });
    });

    it("should fetch action items with valid status and sortBy", async () => {
      req.query = { status: "in-progress", sortBy: "createdAt" };
      mockFindChain();

      await getOpenActionItems(req, res);

      expect(ActionItem.find).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: expect.anything(),
          status: "in-progress",
          lifecycleState: { $nin: ["archived", "expired"] },
        }),
      );
      expect(ActionItem.countDocuments).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          actionItems: [{ _id: "item1" }],
          pagination: expect.objectContaining({
            total: 1,
            page: 1,
            limit: 20,
          }),
          facets: expect.objectContaining({
            owners: expect.any(Array),
            organizations: expect.any(Array),
          }),
        }),
      );
    });

    it("should apply owner filter and pagination on the server", async () => {
      req.query = {
        status: "all",
        sortBy: "dueDate",
        sortOrder: "asc",
        owner: "Alex",
        page: "2",
        limit: "5",
      };
      ActionItem.countDocuments.mockResolvedValue(12);
      const chain = mockFindChain([{ _id: "item2" }]);

      await getOpenActionItems(req, res);

      expect(ActionItem.find).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "Alex",
          lifecycleState: { $nin: ["archived", "expired"] },
        }),
      );
      expect(chain.skip).toHaveBeenCalledWith(5);
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            total: 12,
            page: 2,
            limit: 5,
            totalPages: 3,
            hasMore: true,
          }),
        }),
      );
    });

    it("should escape search input before building regex filters", async () => {
      req.query = { status: "all", sortBy: "createdAt", search: "C++" };
      mockFindChain();

      await getOpenActionItems(req, res);

      expect(Meeting.find).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { $regex: "C\\+\\+", $options: "i" },
        }),
      );
      expect(ActionItem.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { text: { $regex: "C\\+\\+", $options: "i" } },
            { owner: { $regex: "C\\+\\+", $options: "i" } },
          ]),
        }),
      );
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
        select: jest.fn().mockResolvedValue(null),
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

      const mockSave = jest.fn().mockResolvedValue(true);
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
      req.params = {
        type: { $ne: "decision" },
        id: new mongoose.Types.ObjectId().toString(),
      };
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
        select: jest.fn().mockResolvedValue(null),
      });

      await submitMemoryFeedback(req, res);

      expect(Decision.findById).toHaveBeenCalledWith(
        new mongoose.Types.ObjectId(validId),
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
