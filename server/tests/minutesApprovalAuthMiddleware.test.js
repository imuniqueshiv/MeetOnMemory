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
  clerkUserId: "user_test123",
  name: "Authenticated Tester",
  email: "tester@example.com",
  organization: new mongoose.Types.ObjectId().toString(),
};

jest.unstable_mockModule("../utils/authUtils.js", () => ({
  verifyClerkSessionToken: jest.fn(async (token) => {
    if (token === "valid-clerk-token") {
      return {
        sub: mockUser.clerkUserId,
        email: mockUser.email,
        name: mockUser.name,
      };
    }
    throw new Error("Invalid Clerk token");
  }),
  extractClerkIdentityFromClaims: jest.fn((decoded) => ({
    clerkUserId: decoded.sub,
    email: decoded.email,
    name: decoded.name,
  })),
}));

jest.unstable_mockModule("../services/authLinkingService.js", () => ({
  findUserByClerkId: jest.fn(async (clerkId) => {
    if (clerkId === mockUser.clerkUserId) {
      return mockUser;
    }
    return null;
  }),
  provisionOrLinkClerkUser: jest.fn(async () => mockUser),
}));

const { default: minutesApprovalRoutes } =
  await import("../routes/minutesApprovalRoutes.js");

describe("Minutes Approval Route userAuth Authentication Suite (#2619)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/meetings/:meetingId/minutes-approval", minutesApprovalRoutes);
  });

  describe("Authentication Guard Enforcement with Real userAuth Middleware", () => {
    it("should return 401 Unauthorized on GET when no Authorization header is provided", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(
        `/api/meetings/${meetingId}/minutes-approval`,
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("No token found");
    });

    it("should return 401 Unauthorized on POST /submit when invalid token is provided", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/meetings/${meetingId}/minutes-approval/submit`)
        .set("Authorization", "Bearer invalid-token")
        .send({
          snapshotSummary: "Test Summary",
          approvers: [new mongoose.Types.ObjectId().toString()],
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid Clerk token");
    });

    it("should return 401 Unauthorized on PUT /respond without Bearer header", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/api/meetings/${meetingId}/minutes-approval/respond`)
        .send({ status: "approved" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should pass userAuth and reach controller on authenticated GET", async () => {
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
        .set("Authorization", "Bearer valid-clerk-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("not_submitted");
    });

    it("should populate req.user._id into controller execution on POST /submit", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const approverId = new mongoose.Types.ObjectId().toString();

      mockFindOne.mockResolvedValueOnce(null);
      mockFindOneAndUpdate.mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId().toString(),
        meetingId,
        submittedBy: mockUser._id,
        snapshotSummary: "Executive Summary",
        status: "pending",
        approvals: [{ approver: approverId, status: "pending" }],
      });

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/minutes-approval/submit`)
        .set("Authorization", "Bearer valid-clerk-token")
        .send({
          snapshotSummary: "Executive Summary",
          approvers: [approverId],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { meetingId },
        expect.objectContaining({
          submittedBy: mockUser._id,
          snapshotSummary: "Executive Summary",
        }),
        expect.any(Object),
      );
    });
  });
});
