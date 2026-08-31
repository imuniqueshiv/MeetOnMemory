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

const { default: meetingOwnershipTransferRoutes } =
  await import("../routes/meetingOwnershipTransferRoutes.js");
const { initiateTransfer } =
  await import("../controllers/meetingOwnershipTransferController.js");

describe("Ownership Transfer Server Integration Tests (#2666)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/ownership-transfers", meetingOwnershipTransferRoutes);
    app.post(
      "/api/meetings/:meetingId/transfers",
      (req, res, next) => {
        if (!req.headers.authorization) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }
        req.user = mockUser;
        next();
      },
      initiateTransfer,
    );
  });

  describe("GET /api/ownership-transfers/inbox", () => {
    it("returns transfer inbox for authenticated user", async () => {
      const mockTransfers = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          meeting: { title: "Sprint Planning", date: new Date() },
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
      expect(res.body.transfers).toBeDefined();
      expect(Array.isArray(res.body.transfers)).toBe(true);
    });

    it("returns 401 when request is unauthenticated", async () => {
      const res = await request(app).get("/api/ownership-transfers/inbox");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/meetings/:meetingId/transfers", () => {
    it("initiates transfer request successfully (happy path)", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const targetUserId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockImplementation(({ _id }) => {
        if (_id === meetingId) {
          return Promise.resolve({
            _id: meetingId,
            title: "Q3 Strategy",
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

    it("returns 400 validation error when transferring ownership to self", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/transfers`)
        .set("Authorization", "Bearer valid-token")
        .send({ targetUserId: mockUser._id });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Cannot transfer ownership to yourself");
    });

    it("returns 404 when meeting is not found or user is not owner", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const targetUserId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockResolvedValueOnce(null);

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/transfers`)
        .set("Authorization", "Bearer valid-token")
        .send({ targetUserId });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        "Meeting not found or you are not the owner",
      );
    });
  });

  describe("POST /api/ownership-transfers/:transferId/accept", () => {
    it("accepts a pending transfer request", async () => {
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
      expect(res.body.message).toBe("Transfer accepted successfully");
    });

    it("returns 404 when transfer request is not found", async () => {
      const transferId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post(`/api/ownership-transfers/${transferId}/accept`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        "Transfer request not found or not pending",
      );
    });
  });

  describe("POST /api/ownership-transfers/:transferId/reject", () => {
    it("rejects a pending transfer request", async () => {
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
      expect(res.body.message).toBe("Transfer rejected successfully");
    });

    it("returns 404 when transfer request is not found", async () => {
      const transferId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post(`/api/ownership-transfers/${transferId}/reject`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        "Transfer request not found or not pending",
      );
    });
  });
});
