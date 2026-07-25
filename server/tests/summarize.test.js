import request from "supertest"; // eslint-disable-line no-unused-vars
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { app } from "../server.js"; // eslint-disable-line no-unused-vars
import { createCsrfAgent } from "./helpers/csrfHelper.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";
import Meeting from "../models/meetingModel.js";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Mock nodemailer to prevent SMTP verification during tests
jest.mock("../config/nodeMailer.js", () => ({
  sendMail: jest.fn(),
  __esModule: true,
  default: { sendMail: jest.fn() },
}));

describe("Meeting Summarization Authentication and Authorization", () => {
  let userA;
  let userB;
  let userC;
  let orgA;
  let orgB;
  let tokenA;
  let tokenB;
  let tokenC;
  let meetingA;
  let geminiSpy;
  let agent;
  let csrfToken;

  beforeAll(() => {
    geminiSpy = jest
      .spyOn(GoogleGenerativeAI.prototype, "getGenerativeModel")
      .mockImplementation(() => {
        return {
          generateContent: jest.fn().mockResolvedValue({
            response: {
              text: () =>
                JSON.stringify({
                  title: "AI Integration Strategy Discussion",
                  summary:
                    "This is a summary of the meeting about AI Integration.",
                  agenda: ["AI Integration", "Timeline"],
                  key_discussions: ["discussion points"],
                  decisions: ["decision 1"],
                  action_items: [{ task: "action 1", owner: "User A" }],
                  questions_raised: ["question 1"],
                  keywords: ["AI"],
                  attendees: ["User A"],
                  notes: "some notes",
                }),
            },
          }),
        };
      });
  });

  afterAll(() => {
    geminiSpy.mockRestore();
  });

  beforeEach(async () => {
    // 1. Create Organizations
    orgA = await Organization.create({
      name: "Org A",
      slug: "org-a-" + Math.random().toString(36).substring(7),
      owner: new mongoose.Types.ObjectId(),
    });
    orgB = await Organization.create({
      name: "Org B",
      slug: "org-b-" + Math.random().toString(36).substring(7),
      owner: new mongoose.Types.ObjectId(),
    });

    // 2. Create Users
    userA = await User.create({
      name: "User A",
      email: `usera-${Math.random()}@example.com`,
      password: "password123",
      organization: orgA._id,
      role: "member",
    });
    tokenA = jwt.sign(
      { id: userA._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    userB = await User.create({
      name: "User B",
      email: `userb-${Math.random()}@example.com`,
      password: "password123",
      organization: orgB._id,
      role: "member",
    });
    tokenB = jwt.sign(
      { id: userB._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    userC = await User.create({
      name: "User C",
      email: `userc-${Math.random()}@example.com`,
      password: "password123",
      role: "member", // no organization membership
    });
    tokenC = jwt.sign(
      { id: userC._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    // Create memberships
    await Membership.create({
      user: userA._id,
      organization: orgA._id,
      role: "member",
      status: "active",
    });
    await Membership.create({
      user: userB._id,
      organization: orgB._id,
      role: "member",
      status: "active",
    });

    // 3. Create Meeting A belonging to Org A
    meetingA = await Meeting.create({
      uploadedBy: userA._id,
      organization: orgA._id,
      title: "Initial Title",
      date: new Date(),
      transcript: "This is the transcript of a confidential meeting in Org A.",
      status: "completed",
    });

    ({ agent, csrfToken } = await createCsrfAgent());
  });

  describe("POST /api/meetings/summarize", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const res = await agent
        .post("/api/meetings/summarize")
        .set("X-CSRF-Token", csrfToken)
        .send({ meetingId: meetingA._id, date: new Date().toISOString() });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject requests from user without organization membership with 403", async () => {
      const res = await agent
        .post("/api/meetings/summarize")
        .set("Authorization", `Bearer ${tokenC}`)
        .set("X-CSRF-Token", csrfToken)
        .send({ meetingId: meetingA._id, date: new Date().toISOString() });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it("should reject cross-organization summarization requests with 403", async () => {
      const res = await agent
        .post("/api/meetings/summarize")
        .set("Authorization", `Bearer ${tokenB}`)
        .set("X-CSRF-Token", csrfToken)
        .send({ meetingId: meetingA._id, date: new Date().toISOString() });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow authorized user from same organization to summarize meeting", async () => {
      const res = await agent
        .post("/api/meetings/summarize")
        .set("Authorization", `Bearer ${tokenA}`)
        .set("X-CSRF-Token", csrfToken)
        .send({ meetingId: meetingA._id, date: new Date().toISOString() });

      expect([200, 202]).toContain(res.statusCode);
      expect(res.body.success).toBe(true);
      if (res.statusCode === 202) {
        expect(res.body.message).toContain("started in the background");
      } else {
        expect(res.body.message).toContain("generated successfully");
      }
    });
  });
});
