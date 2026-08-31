import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";

const mockFindOne = jest.fn();
const mockFind = jest.fn();
const mockCountDocuments = jest.fn();

jest.unstable_mockModule("../models/weeklyInsightModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    find: (...args) => mockFind(...args),
    countDocuments: (...args) => mockCountDocuments(...args),
  },
}));

const mockGenerateInsight = jest.fn();
jest.unstable_mockModule("../services/weeklyInsightService.js", () => ({
  generateInsight: (...args) => mockGenerateInsight(...args),
}));

const mockUser = {
  _id: new mongoose.Types.ObjectId().toString(),
  name: "Admin User",
  role: "admin",
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
  requireRole: () => (req, res, next) => next(),
}));

const { default: weeklyInsightRoutes } =
  await import("../routes/weeklyInsightRoutes.js");

describe("Weekly Insights Server API Route Prefix Guards Suite (#2620)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/weekly-insights", weeklyInsightRoutes);
  });

  describe("API Route Prefix Enforcement against Production Routes", () => {
    it("should return 200 for GET /api/weekly-insights/:orgId/latest", async () => {
      const orgId = new mongoose.Types.ObjectId().toString();
      const mockInsight = {
        _id: new mongoose.Types.ObjectId().toString(),
        organization: orgId,
        summary: "Weekly summary",
      };

      mockFindOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockInsight),
          }),
        }),
      });

      const res = await request(app)
        .get(`/api/weekly-insights/${orgId}/latest`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(mockInsight._id);
    });

    it("should return 404 for un-prefixed GET /weekly-insights/:orgId/latest", async () => {
      const orgId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/weekly-insights/${orgId}/latest`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });

    it("should return 200 for GET /api/weekly-insights/:orgId with pagination params", async () => {
      const orgId = new mongoose.Types.ObjectId().toString();
      mockFind.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockCountDocuments.mockResolvedValueOnce(0);

      const res = await request(app)
        .get(`/api/weekly-insights/${orgId}?page=2&limit=5`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.currentPage).toBe(2);
      expect(Array.isArray(res.body.insights)).toBe(true);
    });

    it("should return 404 for un-prefixed GET /weekly-insights/:orgId", async () => {
      const orgId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/weekly-insights/${orgId}?page=1`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });

    it("should return 201 for POST /api/weekly-insights/:orgId/generate", async () => {
      const orgId = new mongoose.Types.ObjectId().toString();
      const mockCreated = {
        _id: new mongoose.Types.ObjectId().toString(),
        organization: orgId,
      };
      mockGenerateInsight.mockResolvedValueOnce(mockCreated);

      const res = await request(app)
        .post(`/api/weekly-insights/${orgId}/generate`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(201);
      expect(res.body._id).toBe(mockCreated._id);
    });

    it("should return 404 for un-prefixed POST /weekly-insights/:orgId/generate", async () => {
      const orgId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/weekly-insights/${orgId}/generate`)
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });
  });
});
