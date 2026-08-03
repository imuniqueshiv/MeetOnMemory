import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import Tag from "../models/tagModel.js";
import DigestPreference from "../models/digestPreferenceModel.js";
import {
  getPreferences,
  updatePreferences,
} from "../controllers/digestPreferenceController.js";

describe("Digest Preferences Controller - Tag Ownership Validation", () => {
  let app;
  let mockUser;
  let mockOrgId;

  beforeAll(() => {
    mockOrgId = new mongoose.Types.ObjectId();
    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test User",
      email: "test@example.com",
      organization: mockOrgId,
    };

    app = express();
    app.use(express.json());

    // Inject mock auth user
    app.use((req, res, next) => {
      req.user = mockUser;
      next();
    });

    app.get("/api/digest-preferences", getPreferences);
    app.put("/api/digest-preferences", updatePreferences);
  });

  beforeEach(async () => {
    // Mock DB operations on Tag and DigestPreference
    jest.restoreAllMocks();
  });

  describe("PUT /api/digest-preferences tag ownership validation", () => {
    it("should accept tag IDs owned by the user's organization", async () => {
      const validTagId = new mongoose.Types.ObjectId();

      jest.spyOn(Tag, "find").mockImplementation(() => ({
        select: jest.fn().mockResolvedValue([{ _id: validTagId }]),
      }));

      jest.spyOn(DigestPreference, "findOneAndUpdate").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        user: mockUser._id,
        frequency: "weekly",
        filterByTags: [validTagId],
      });

      const res = await request(app)
        .put("/api/digest-preferences")
        .send({
          frequency: "weekly",
          filterByTags: [validTagId.toString()],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.filterByTags).toHaveLength(1);
    });

    it("should reject tag IDs belonging to another organization", async () => {
      const unauthorizedTagId = new mongoose.Types.ObjectId();

      jest.spyOn(Tag, "find").mockImplementation(() => ({
        select: jest.fn().mockResolvedValue([]), // No matching tags found for user's org
      }));

      const res = await request(app)
        .put("/api/digest-preferences")
        .send({
          frequency: "weekly",
          filterByTags: [unauthorizedTagId.toString()],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /invalid or do not belong to your organization/i,
      );
    });

    it("should reject invalid tag ID format", async () => {
      const res = await request(app)
        .put("/api/digest-preferences")
        .send({
          frequency: "weekly",
          filterByTags: ["invalid-object-id"],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid tag id format/i);
    });

    it("should reject tag filtering if user has no organization", async () => {
      const validTagId = new mongoose.Types.ObjectId();

      // Temporarily clear user organization
      const origOrg = mockUser.organization;
      mockUser.organization = null;

      const res = await request(app)
        .put("/api/digest-preferences")
        .send({
          frequency: "weekly",
          filterByTags: [validTagId.toString()],
        });

      mockUser.organization = origOrg;

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/must belong to an organization/i);
    });
  });
});
