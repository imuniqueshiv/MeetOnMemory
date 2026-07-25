import request from "supertest"; // eslint-disable-line no-unused-vars
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import axios from "axios";
import { jest } from "@jest/globals";
import { app } from "../server.js"; // eslint-disable-line no-unused-vars
import { createCsrfAgent, refreshCsrfToken } from "./helpers/csrfHelper.js"; // eslint-disable-line no-unused-vars
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
  let organization;
  let userToken;
  let guestToken;
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
    userToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

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
    guestToken = jwt.sign(
      { id: guestUser._id },
      process.env.JWT_SECRET || "fallback_secret",
    );
  });

  describe("POST /api/gemini/insights", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const { agent, csrfToken } = await createCsrfAgent();
      const res = await agent
        .post("/api/gemini/insights")
        .set("X-CSRF-Token", csrfToken)
        .send({ summary: { totalMeetings: 5, activePolicies: 2 } });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject unauthorized requests from guest with 403", async () => {
      const { agent, csrfToken } = await createCsrfAgent();
      const res = await agent
        .post("/api/gemini/insights")
        .set("Authorization", `Bearer ${guestToken}`)
        .set("X-CSRF-Token", csrfToken)
        .send({ summary: { totalMeetings: 5, activePolicies: 2 } });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow authenticated member with view reports permission to generate insights", async () => {
      const { agent, csrfToken } = await createCsrfAgent();
      const res = await agent
        .post("/api/gemini/insights")
        .set("Authorization", `Bearer ${userToken}`)
        .set("X-CSRF-Token", csrfToken)
        .send({ summary: { totalMeetings: 5, activePolicies: 2 } });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.insight).toBe(
        "This is a mocked professional analytics summary highlighting trends and insights.",
      );
    });
  });
});
