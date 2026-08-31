import {
  bulkResolveConflicts,
  getConflictAuditHistory,
} from "../controllers/conflictController.js";
import {
  getConflictSetById,
  resolveConflictSet,
} from "../services/conflictDetection/conflictDetectionService.js";
import AuditLog from "../models/auditLogModel.js";

jest.mock("../services/conflictDetection/conflictDetectionService.js", () => ({
  getConflictSetById: jest.fn(),
  resolveConflictSet: jest.fn(),
}));

jest.mock("../models/auditLogModel.js", () => {
  return {
    __esModule: true,
    default: {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0),
    },
  };
});

describe("Conflict Resolution Bulk + History", () => {
  let req, res;
  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: "user-1", organization: "org-1" },
      query: {},
      params: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("bulkResolveConflicts", () => {
    it("fails if conflictIds missing", async () => {
      await bulkResolveConflicts(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "conflictIds array is required",
      });
    });

    it("bulk dismisses selected conflicts and creates one audit log", async () => {
      req.body = { conflictIds: ["id1", "id2"], resolutionType: "dismissed" };

      getConflictSetById.mockResolvedValue({
        _id: "id1",
        organization: { toString: () => "org-1" },
      });
      resolveConflictSet.mockResolvedValue({
        _id: "id1",
        modelType: "decision",
        resolution: { type: "dismissed" },
      });

      await bulkResolveConflicts(req, res);

      expect(resolveConflictSet).toHaveBeenCalledTimes(2);
      expect(AuditLog.create).toHaveBeenCalledTimes(1);
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "conflict_bulk_resolved",
          details: expect.objectContaining({ resolvedCount: 2 }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getConflictAuditHistory", () => {
    it("returns history logs", async () => {
      req.query = { page: 1, limit: 10 };
      const mockLogs = [{ _id: "log1", action: "conflict_resolved" }];
      AuditLog.populate.mockResolvedValue(mockLogs);
      AuditLog.countDocuments.mockResolvedValue(1);

      await getConflictAuditHistory(req, res);

      expect(AuditLog.find).toHaveBeenCalledWith({
        organization: "org-1",
        action: { $in: ["conflict_resolved", "conflict_bulk_resolved"] },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ history: mockLogs, total: 1 }),
      );
    });
  });
});
