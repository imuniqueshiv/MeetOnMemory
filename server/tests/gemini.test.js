import request from "supertest";
import mongoose from "mongoose";
import axios from "axios";
import { jest } from "@jest/globals";
import { app } from "../server.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";

// Mock nodemailer to prevent SMTP verification during tests
jest.mock("../config/nodeMailer.js", () => ({
  sendMail: jest.fn(),
  __esModule: true,
  default: { sendMail: jest.fn() },
}));

describe("Gemini AI Endpoint Authentication and Authorization", () => {
  let user;
  let guestUser;
  let noOrgUser;
  let organization;
  let userToken;
  let guestToken;
  let noOrgToken;
  let axiosSpy;

  beforeAll(() => {
    // Mock Axios POST for Gemini generateContent call
    axiosSpy = jest.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "This is a mocked professional analytics summary highlighting trends and insights.",
                },
              ],
            },
          },
        ],
      },
    });
  });

  afterAll(() => {
    axiosSpy.mockRestore();
  });

  beforeEach(async () => {
    axiosSpy.mockClear();

    // Set up test organization
    organization = await Organization.create({
      name: "Acme Analytics",
      slug: "acme-analytics-" + Math.random().toString(36).substring(7),
      owner: new mongoose.Types.ObjectId(),
    });

    // Create normal member user
    user = await User.create({
      name: "Normal Member",
      email: `member-${Math.random()}@example.com`,
      password: "password123",
      organization: organization._id,
      role: "admin",
    });
    user.clerkUserId = `user_test_${user._id}`;
    await user.save();
    userToken = createClerkTestToken({
      clerkUserId: user.clerkUserId,
      email: user.email,
    });

    await Membership.create({
      user: user._id,
      organization: organization._id,
      role: "admin",
      status: "active",
    });

    // Create guest user (no report view permission)
    guestUser = await User.create({
      name: "Guest User",
      email: `guest-${Math.random()}@example.com`,
      password: "password123",
      organization: organization._id,
      role: "guest",
    });
    guestUser.clerkUserId = `user_test_${guestUser._id}`;
    await guestUser.save();
    guestToken = createClerkTestToken({
      clerkUserId: guestUser.clerkUserId,
      email: guestUser.email,
    });

    // Authenticated user with no organization (org isolation)
    noOrgUser = await User.create({
      name: "No Org User",
      email: `no-org-${Math.random()}@example.com`,
      password: "password123",
      role: "admin",
    });
    noOrgUser.clerkUserId = `user_test_${noOrgUser._id}`;
    await noOrgUser.save();
    noOrgToken = createClerkTestToken({
      clerkUserId: noOrgUser.clerkUserId,
      email: noOrgUser.email,
    });
  });

  describe("POST /api/gemini/insights", () => {
    const validBody = { summary: { totalMeetings: 5, activePolicies: 2 } };

    it("should reject unauthenticated requests with 401", async () => {
      const res = await request(app)
        .post("/api/gemini/insights")
        .send(validBody);

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject users without organization membership with 403", async () => {
      const res = await request(app)
        .post("/api/gemini/insights")
        .set(authHeader(noOrgToken))
        .send(validBody);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(axiosSpy).not.toHaveBeenCalled();
    });

    it("should reject unauthorized requests from guest with 403", async () => {
      const res = await request(app)
        .post("/api/gemini/insights")
        .set(authHeader(guestToken))
        .send(validBody);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it("should reject missing summary with 400", async () => {
      const res = await request(app)
        .post("/api/gemini/insights")
        .set(authHeader(userToken))
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Validation failed");
      expect(axiosSpy).not.toHaveBeenCalled();
    });

    it("should reject non-object summary with 400", async () => {
      const res = await request(app)
        .post("/api/gemini/insights")
        .set(authHeader(userToken))
        .send({ summary: "not-an-object" });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(axiosSpy).not.toHaveBeenCalled();
    });

    it("should reject oversized summary with 400", async () => {
      const res = await request(app)
        .post("/api/gemini/insights")
        .set(authHeader(userToken))
        .send({ summary: { blob: "x".repeat(10_001) } });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(axiosSpy).not.toHaveBeenCalled();
    });

    it("should allow authenticated member with view reports permission to generate insights", async () => {
      const res = await request(app)
        .post("/api/gemini/insights")
        .set(authHeader(userToken))
        .send(validBody);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.insight).toBe(
        "This is a mocked professional analytics summary highlighting trends and insights.",
      );
    });
  });
});
