import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";

const mockFind = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockCountDocuments = jest.fn();

jest.unstable_mockModule("../models/asyncMeetingModel.js", () => ({
  default: {
    find: (...args) => mockFind(...args),
    findById: (...args) => mockFindById(...args),
    create: (...args) => mockCreate(...args),
    countDocuments: (...args) => mockCountDocuments(...args),
  },
}));

const mockUserId = new mongoose.Types.ObjectId().toString();
const mockUser = {
  _id: mockUserId,
  name: "Async Participant",
  role: "member",
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

jest.unstable_mockModule("../middleware/rateLimiter.js", () => ({
  apiLimiter: (req, res, next) => next(),
  writeLimiter: (req, res, next) => next(),
}));

const { default: asyncMeetingRoutes } =
  await import("../routes/asyncMeetingRoutes.js");

describe("Async Meetings Server API Route Prefix Guards Suite (#2621)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/async-meetings", asyncMeetingRoutes);
  });

  describe("API Prefix Guard Verification against Production Routes", () => {
    it("should respond 200 for GET /api/async-meetings with valid auth", async () => {
      mockFind.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });
      mockCountDocuments.mockResolvedValueOnce(0);

      const res = await request(app)
        .get("/api/async-meetings")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should respond 404 for un-prefixed GET /async-meetings", async () => {
      const res = await request(app)
        .get("/async-meetings")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });

    it("should respond 201 for POST /api/async-meetings with valid auth", async () => {
      const mockCreated = {
        _id: new mongoose.Types.ObjectId().toString(),
        title: "Design Review (Async)",
        creator: mockUserId,
      };
      mockCreate.mockResolvedValueOnce(mockCreated);

      const res = await request(app)
        .post("/api/async-meetings")
        .set("Authorization", "Bearer valid-token")
        .send({
          title: "Design Review (Async)",
          template: ["Updates?"],
          deadline: new Date(Date.now() + 86400000).toISOString(),
          participants: [mockUserId],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Design Review (Async)");
    });

    it("should respond 404 for un-prefixed POST /async-meetings", async () => {
      const res = await request(app)
        .post("/async-meetings")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "Design Review" });

      expect(res.status).toBe(404);
    });

    it("should respond 200 for POST /api/async-meetings/:meetingId/submit", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockMeetingDoc = {
        _id: meetingId,
        creator: mockUserId,
        deadline: new Date(Date.now() + 86400000),
        status: "pending",
        submissions: [],
        save: mockSave,
      };
      mockFindById.mockResolvedValueOnce(mockMeetingDoc);

      const res = await request(app)
        .post(`/api/async-meetings/${meetingId}/submit`)
        .set("Authorization", "Bearer valid-token")
        .send({ answers: [{ question: "Progress?", answer: "On track" }] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should respond 404 for un-prefixed POST /async-meetings/:meetingId/submit", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/async-meetings/${meetingId}/submit`)
        .set("Authorization", "Bearer valid-token")
        .send({ answers: [] });

      expect(res.status).toBe(404);
    });

    it("should respond 200 for GET /api/async-meetings/:meetingId", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockMeeting = {
        _id: meetingId,
        title: "Async Meeting Detail",
        creator: mockUserId,
      };
      mockFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockMeeting),
          }),
        }),
      });

      const res = await request(app)
        .get(`/api/async-meetings/${meetingId}`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(meetingId);
    });
  });
});
