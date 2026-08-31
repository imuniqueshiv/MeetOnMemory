import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";

const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();

jest.unstable_mockModule("../models/minutesApprovalModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args),
  },
}));

// Mock @clerk/express middleware
jest.unstable_mockModule("@clerk/express", () => ({
  requireAuth: () => (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthenticated" });
    }
    next();
  },
}));

const { default: minutesApprovalRoutes } =
  await import("../routes/minutesApprovalRoutes.js");

describe("Minutes Approval Server Integration Tests (#2666)", () => {
  let app;
  let unauthApp;
  const mockUser = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: "Submitter User",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = mockUser;
      next();
    });
    app.use("/api/meetings/:meetingId/minutes-approval", minutesApprovalRoutes);

    unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.use(
      "/api/meetings/:meetingId/minutes-approval",
      minutesApprovalRoutes,
    );
  });

  describe("GET /api/meetings/:meetingId/minutes-approval", () => {
    it("returns approval document status when record exists", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockDoc = {
        meetingId,
        status: "pending",
        snapshotSummary: "Summary text",
        approvals: [],
      };

      mockFindOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockDoc),
          }),
        }),
      });

      const res = await request(app).get(
        `/api/meetings/${meetingId}/minutes-approval`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: mockDoc,
        status: "pending",
      });
    });

    it("returns not_submitted status when no approval record exists", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      const res = await request(app).get(
        `/api/meetings/${meetingId}/minutes-approval`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: null,
        status: "not_submitted",
      });
    });

    it("returns 400 validation error for invalid meeting ID", async () => {
      const res = await request(app).get(
        "/api/meetings/invalid-id/minutes-approval",
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid meeting id");
    });

    it("returns 401 unauthenticated when no auth token provided", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const res = await request(unauthApp).get(
        `/api/meetings/${meetingId}/minutes-approval`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/meetings/:meetingId/minutes-approval/submit", () => {
    it("submits minutes for approval successfully (happy path)", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const approverId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockResolvedValueOnce(null);
      mockFindOneAndUpdate.mockResolvedValueOnce({
        meetingId,
        status: "pending",
        snapshotSummary: "Executive Summary",
        approvals: [{ approver: approverId, status: "pending" }],
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/minutes-approval/submit`)
        .send({
          snapshotSummary: "Executive Summary",
          approvers: [approverId],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("pending");
    });

    it("accepts summary and approverIds payload field aliases", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const approverId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockResolvedValueOnce(null);
      mockFindOneAndUpdate.mockResolvedValueOnce({
        meetingId,
        status: "pending",
        snapshotSummary: "Executive Summary Alias",
        approvals: [{ approver: approverId, status: "pending" }],
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/minutes-approval/submit`)
        .send({
          summary: "Executive Summary Alias",
          approverIds: [approverId],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("returns 400 validation error when summary is missing", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const approverId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/minutes-approval/submit`)
        .send({ approvers: [approverId] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("snapshotSummary is required");
    });

    it("returns 400 validation error when approvers array is empty", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/minutes-approval/submit`)
        .send({ snapshotSummary: "Summary", approvers: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("approvers must be a non-empty array");
    });
  });

  describe("PUT /api/meetings/:meetingId/minutes-approval/respond", () => {
    it("records approver decision successfully", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockSave = jest.fn().mockResolvedValue(true);

      const mockDoc = {
        meetingId,
        status: "pending",
        approvals: [
          {
            approver: mockUser._id,
            status: "pending",
            comment: "",
            respondedAt: null,
          },
        ],
        save: mockSave,
      };

      mockFindOne.mockResolvedValueOnce(mockDoc);

      const res = await request(app)
        .put(`/api/meetings/${meetingId}/minutes-approval/respond`)
        .send({ status: "approved", comment: "Approved by me" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSave).toHaveBeenCalled();
    });

    it("returns 404 when no minutes submitted for meeting", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      mockFindOne.mockResolvedValueOnce(null);

      const res = await request(app)
        .put(`/api/meetings/${meetingId}/minutes-approval/respond`)
        .send({ status: "approved" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe(
        "No minutes have been submitted for this meeting",
      );
    });

    it("returns 403 authorization error when user is not an approver", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockDoc = {
        meetingId,
        status: "pending",
        approvals: [{ approver: "other-user-id", status: "pending" }],
      };

      mockFindOne.mockResolvedValueOnce(mockDoc);

      const res = await request(app)
        .put(`/api/meetings/${meetingId}/minutes-approval/respond`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("You are not an approver for these minutes");
    });
  });
});
