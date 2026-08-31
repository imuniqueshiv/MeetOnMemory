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

describe("Async Meetings Server Integration Tests (#2666)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/async-meetings", asyncMeetingRoutes);
  });

  describe("GET /api/async-meetings", () => {
    it("lists async meetings for authenticated user", async () => {
      const mockMeetings = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          title: "Weekly Update",
          status: "pending",
          creator: mockUserId,
        },
      ];

      mockFind.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue(mockMeetings),
                }),
              }),
            }),
          }),
        }),
      });
      mockCountDocuments.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/async-meetings?status=pending")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockMeetings);
      expect(res.body.pagination).toBeDefined();
    });

    it("returns 400 when an invalid status filter is provided", async () => {
      const res = await request(app)
        .get("/api/async-meetings?status=invalid_status")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Unsupported status filter");
    });

    it("returns 401 unauthenticated when credentials are missing", async () => {
      const res = await request(app).get("/api/async-meetings");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/async-meetings/:id", () => {
    it("fetches single async meeting by ID", async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const mockMeeting = {
        _id: id,
        title: "Sprint Debrief",
        creator: mockUserId,
        participants: [mockUserId],
      };

      mockFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockMeeting),
          }),
        }),
      });

      const res = await request(app)
        .get(`/api/async-meetings/${id}`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(id);
    });

    it("returns 404 when async meeting does not exist", async () => {
      const id = new mongoose.Types.ObjectId().toString();

      mockFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      const res = await request(app)
        .get(`/api/async-meetings/${id}`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Async meeting not found");
    });

    it("returns 400 for malformed MongoDB ObjectId", async () => {
      const res = await request(app)
        .get("/api/async-meetings/invalid-id")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid async meeting id");
    });
  });

  describe("POST /api/async-meetings/:id/submit", () => {
    it("submits participant update successfully (happy path)", async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockMeetingDoc = {
        _id: id,
        creator: mockUserId,
        deadline: new Date(Date.now() + 86400000),
        status: "pending",
        submissions: [],
        save: mockSave,
      };

      mockFindById.mockResolvedValueOnce(mockMeetingDoc);

      const res = await request(app)
        .post(`/api/async-meetings/${id}/submit`)
        .set("Authorization", "Bearer valid-token")
        .send({
          answers: [
            { question: "What's blocked?", answer: "Nothing at the moment" },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSave).toHaveBeenCalled();
    });

    it("returns 403 SUBMISSION_LOCKED when deadline has passed", async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const mockMeetingDoc = {
        _id: id,
        creator: mockUserId,
        deadline: new Date(Date.now() - 3600000),
        status: "pending",
        submissions: [],
      };

      mockFindById.mockResolvedValueOnce(mockMeetingDoc);

      const res = await request(app)
        .post(`/api/async-meetings/${id}/submit`)
        .set("Authorization", "Bearer valid-token")
        .send({
          answers: [{ question: "Q", answer: "A" }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("SUBMISSION_LOCKED");
    });

    it("returns 400 validation error when answers array is missing or empty", async () => {
      const id = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/async-meetings/${id}/submit`)
        .set("Authorization", "Bearer valid-token")
        .send({ answers: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("answers must be a non-empty array");
    });
  });
});
