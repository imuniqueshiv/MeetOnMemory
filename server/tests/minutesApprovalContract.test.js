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

const mockUser = {
  _id: new mongoose.Types.ObjectId().toString(),
  name: "Approver User",
  organization: new mongoose.Types.ObjectId().toString(),
};

jest.unstable_mockModule("@clerk/express", () => ({
  requireAuth: () => (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = mockUser;
    next();
  },
}));

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = mockUser;
    next();
  },
  sanitizeAuthRequestForLog: jest.fn(),
}));

const { default: minutesApprovalRoutes } =
  await import("../routes/minutesApprovalRoutes.js");

describe("Minutes Approval Controller & Route Contract Suite (#2618)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/meetings/:meetingId/minutes-approval", minutesApprovalRoutes);
  });

  describe("GET /api/meetings/:meetingId/minutes-approval", () => {
    it("should return approval status and data contract on valid meetingId", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        meetingId,
        snapshotSummary: "Summary content",
        status: "pending",
        approvals: [
          {
            approver: { _id: "u1", name: "User One" },
            status: "pending",
          },
        ],
      };

      mockFindOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockDoc),
          }),
        }),
      });

      const res = await request(app)
        .get(`/api/meetings/${meetingId}/minutes-approval`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("pending");
      expect(res.body.data._id).toBe(mockDoc._id);
    });

    it("should return not_submitted when no approval exists for meeting", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      const res = await request(app)
        .get(`/api/meetings/${meetingId}/minutes-approval`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("not_submitted");
      expect(res.body.data).toBeNull();
    });

    it("should return 404 for un-prefixed GET route", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/meetings/${meetingId}/minutes-approval`)
        .set("Authorization", "Bearer valid-token");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/meetings/:meetingId/minutes-approval/submit", () => {
    it("should accept snapshotSummary and approvers array and return 201", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const approverId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockResolvedValueOnce(null);
      mockFindOneAndUpdate.mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId().toString(),
        meetingId,
        snapshotSummary: "Q3 Revenue Goals Summary",
        status: "pending",
        approvals: [{ approver: approverId, status: "pending" }],
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/minutes-approval/submit`)
        .set("Authorization", "Bearer valid-token")
        .send({
          snapshotSummary: "Q3 Revenue Goals Summary",
          approvers: [approverId],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.snapshotSummary).toBe("Q3 Revenue Goals Summary");
      expect(res.body.data.approvals).toHaveLength(1);
    });

    it("should return 400 when snapshotSummary is missing", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const approverId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/minutes-approval/submit`)
        .set("Authorization", "Bearer valid-token")
        .send({ approvers: [approverId] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("snapshotSummary is required");
    });
  });

  describe("PUT /api/meetings/:meetingId/minutes-approval/respond", () => {
    it("should record approver response and return updated document data", async () => {
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
        .set("Authorization", "Bearer valid-token")
        .send({
          status: "approved",
          comment: "Approved after reviewing action items.",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("approved");
      expect(res.body.data.approvals[0].comment).toBe(
        "Approved after reviewing action items.",
      );
    });
  });
});
