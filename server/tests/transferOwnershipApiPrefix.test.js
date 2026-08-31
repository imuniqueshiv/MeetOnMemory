import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";

const mockFindOne = jest.fn();
const mockFind = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();

jest.unstable_mockModule("../models/meetingOwnershipTransferModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    find: (...args) => mockFind(...args),
    create: (...args) => mockCreate(...args),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    findById: (...args) => mockFindById(...args),
  },
}));

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    findById: (...args) => mockFindById(...args),
  },
}));

jest.unstable_mockModule("../models/auditLogModel.js", () => ({
  default: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.unstable_mockModule("../services/notificationService.js", () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

const mockUser = {
  _id: new mongoose.Types.ObjectId().toString(),
  name: "Current Owner",
  organization: new mongoose.Types.ObjectId().toString(),
};

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = mockUser;
    next();
  },
  sanitizeAuthRequestForLog: jest.fn(),
}));

jest.unstable_mockModule("../middleware/rbac.js", () => ({
  requireOwner: () => (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireOrgMembership: (req, res, next) => next(),
  requireOrgAccess: () => (req, res, next) => next(),
  requireAdminOrOwner: (req, res, next) => next(),
  requireOwnerOrAdmin: () => (req, res, next) => next(),
}));

jest.unstable_mockModule("../middleware/rateLimiter.js", () => ({
  apiLimiter: (req, res, next) => next(),
  writeLimiter: (req, res, next) => next(),
  uploadLimiter: (req, res, next) => next(),
}));

const { default: appRouter } = await import("../routes/index.js");

describe("Ownership Transfer API Route Prefix Guard Suite (#2617)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use(appRouter);
  });

  describe("API Prefix Enforcement against Production Routes", () => {
    it("should respond 201 for POST /api/meetings/:meetingId/transfers with valid auth", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const targetUserId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockImplementation(({ _id }) => {
        if (_id === meetingId) {
          return Promise.resolve({
            _id: meetingId,
            title: "Sprint Planning",
            organization: mockUser.organization,
          });
        }
        return Promise.resolve(null);
      });

      mockFindById.mockResolvedValueOnce({
        _id: targetUserId,
        organization: mockUser.organization,
      });

      mockCreate.mockResolvedValueOnce({
        _id: "t-101",
        meeting: meetingId,
        fromUser: mockUser._id,
        toUser: targetUserId,
        status: "pending",
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/transfers`)
        .set("Authorization", "Bearer valid-token")
        .send({ targetUserId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Transfer request initiated successfully");
    });

    it("should respond 404 for un-prefixed POST /meetings/:meetingId/transfers", async () => {
      const res = await request(app)
        .post("/meetings/m123/transfers")
        .set("Authorization", "Bearer valid-token")
        .send({ targetUserId: "u456" });

      expect(res.status).toBe(404);
    });

    it("should respond 200 for GET /api/ownership-transfers/inbox with valid auth", async () => {
      const mockTransfers = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          meeting: { title: "Roadmap Review", date: new Date() },
          fromUser: { name: "Alice", email: "alice@example.com" },
          status: "pending",
        },
      ];

      mockFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockTransfers),
          }),
        }),
      });

      const res = await request(app)
        .get("/api/ownership-transfers/inbox")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.transfers)).toBe(true);
    });

    it("should respond 404 for un-prefixed GET /ownership-transfers/inbox", async () => {
      const res = await request(app)
        .get("/ownership-transfers/inbox")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });

    it("should respond 200 for POST /api/ownership-transfers/:transferId/accept", async () => {
      const transferId = new mongoose.Types.ObjectId().toString();
      const meetingId = new mongoose.Types.ObjectId().toString();

      const mockSave = jest.fn().mockResolvedValue(true);
      const mockTransferDoc = {
        _id: transferId,
        meeting: { _id: meetingId, title: "Architecture Sync" },
        organization: mockUser.organization,
        fromUser: "owner-1",
        toUser: mockUser._id,
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
        save: mockSave,
      };

      mockFindOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(mockTransferDoc),
      });

      const mockMeetingDoc = {
        _id: meetingId,
        title: "Architecture Sync",
        uploadedBy: "owner-1",
        save: mockSave,
      };
      mockFindById.mockResolvedValueOnce(mockMeetingDoc);

      const res = await request(app)
        .post(`/api/ownership-transfers/${transferId}/accept`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Transfer accepted successfully");
    });

    it("should respond 404 for un-prefixed POST /ownership-transfers/:transferId/accept", async () => {
      const res = await request(app)
        .post("/ownership-transfers/t100/accept")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });

    it("should respond 200 for POST /api/ownership-transfers/:transferId/reject", async () => {
      const transferId = new mongoose.Types.ObjectId().toString();

      const mockSave = jest.fn().mockResolvedValue(true);
      const mockTransferDoc = {
        _id: transferId,
        meeting: { title: "Roadmap Sync" },
        fromUser: "owner-1",
        status: "pending",
        save: mockSave,
      };

      mockFindOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(mockTransferDoc),
      });

      const res = await request(app)
        .post(`/api/ownership-transfers/${transferId}/reject`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Transfer rejected successfully");
    });

    it("should respond 404 for un-prefixed POST /ownership-transfers/:transferId/reject", async () => {
      const res = await request(app)
        .post("/ownership-transfers/t100/reject")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });
  });
});
