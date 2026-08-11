/**
 * Issue #1378 — speaker mapping endpoints must resolve the meeting and enforce
 * organization access before any read/write. Cross-org callers must not be able
 * to list, suggest, apply, or revert mappings for another tenant's meeting.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

let currentUser = null;

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = currentUser;
    next();
  },
}));

const mockSuggestMappings = jest.fn().mockResolvedValue([]);
const mockApplyMapping = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule("../services/speakerIdentificationService.js", () => ({
  default: {
    suggestMappings: mockSuggestMappings,
    applyMapping: mockApplyMapping,
  },
}));

const { default: speakerMappingRoutes } =
  await import("../routes/speakerMappingRoutes.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { default: SpeakerMapping } =
  await import("../models/speakerMappingModel.js");

await import("../models/userModel.js");
await import("../models/organizationModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const alice = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

const aliceViewer = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "viewer",
};

const mallory = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
  role: "admin",
};

const noOrgUser = {
  _id: new mongoose.Types.ObjectId(),
  organization: null,
  role: "member",
};

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }

  app = express();
  app.use(express.json());
  app.use("/api/speaker-mappings", speakerMappingRoutes);
});

beforeEach(() => {
  currentUser = alice;
  mockSuggestMappings.mockClear();
  mockApplyMapping.mockClear();
});

const seedMeeting = async ({
  organization,
  uploadedBy,
  title = "Planning",
} = {}) => {
  return Meeting.create({
    uploadedBy,
    organization,
    title,
    date: new Date(),
  });
};

describe("Speaker mapping authorization (#1378)", () => {
  describe("same-organization access", () => {
    it("allows a same-org member to list mappings", async () => {
      const meeting = await seedMeeting({
        organization: ORG_A,
        uploadedBy: alice._id,
      });
      await SpeakerMapping.create({
        meeting: meeting._id,
        organization: ORG_A,
        originalLabel: "Speaker A",
        mappedName: "Alice",
        createdBy: alice._id,
        isConfirmed: true,
      });

      const res = await request(app).get(
        `/api/speaker-mappings/${meeting._id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].mappedName).toBe("Alice");
    });

    it("allows a same-org member to create/apply a mapping", async () => {
      const meeting = await seedMeeting({
        organization: ORG_A,
        uploadedBy: alice._id,
      });

      const res = await request(app)
        .post(`/api/speaker-mappings/${meeting._id}`)
        .send({ originalLabel: "Speaker A", mappedName: "Alice" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mappedName).toBe("Alice");
      expect(mockApplyMapping).toHaveBeenCalledWith(
        meeting._id.toString(),
        "Speaker A",
        "Alice",
      );
    });

    it("allows a same-org member to update/apply and revert a mapping", async () => {
      const meeting = await seedMeeting({
        organization: ORG_A,
        uploadedBy: alice._id,
      });

      const createRes = await request(app)
        .post(`/api/speaker-mappings/${meeting._id}`)
        .send({ originalLabel: "Speaker B", mappedName: "Bob" });
      expect(createRes.status).toBe(200);

      const mappingId = createRes.body.data._id;
      const revertRes = await request(app).delete(
        `/api/speaker-mappings/${meeting._id}/${mappingId}`,
      );

      expect(revertRes.status).toBe(200);
      expect(revertRes.body.success).toBe(true);
      expect(mockApplyMapping).toHaveBeenCalled();
    });

    it("allows a same-org member to request suggestions", async () => {
      const meeting = await seedMeeting({
        organization: ORG_A,
        uploadedBy: alice._id,
      });
      mockSuggestMappings.mockResolvedValueOnce([
        { originalLabel: "Speaker A", mappedName: "Alice" },
      ]);

      const res = await request(app).get(
        `/api/speaker-mappings/${meeting._id}/suggest`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSuggestMappings).toHaveBeenCalledWith(meeting._id.toString());
    });
  });

  describe("cross-organization access", () => {
    it("returns 403 when listing mappings for another org's meeting", async () => {
      const meeting = await seedMeeting({
        organization: ORG_B,
        uploadedBy: mallory._id,
        title: "Confidential",
      });
      await SpeakerMapping.create({
        meeting: meeting._id,
        organization: ORG_B,
        originalLabel: "Speaker X",
        mappedName: "Secret",
        createdBy: mallory._id,
        isConfirmed: true,
      });

      currentUser = alice;
      const res = await request(app).get(
        `/api/speaker-mappings/${meeting._id}`,
      );

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/access/i);
    });

    it("returns 403 when creating/applying a mapping on another org's meeting", async () => {
      const meeting = await seedMeeting({
        organization: ORG_B,
        uploadedBy: mallory._id,
      });

      currentUser = alice;
      const res = await request(app)
        .post(`/api/speaker-mappings/${meeting._id}`)
        .send({ originalLabel: "Speaker A", mappedName: "Attacker" });

      expect(res.status).toBe(403);
      expect(mockApplyMapping).not.toHaveBeenCalled();
      const count = await SpeakerMapping.countDocuments({
        meeting: meeting._id,
      });
      expect(count).toBe(0);
    });

    it("returns 403 when suggesting mappings for another org's meeting", async () => {
      const meeting = await seedMeeting({
        organization: ORG_B,
        uploadedBy: mallory._id,
      });

      currentUser = alice;
      const res = await request(app).get(
        `/api/speaker-mappings/${meeting._id}/suggest`,
      );

      expect(res.status).toBe(403);
      expect(mockSuggestMappings).not.toHaveBeenCalled();
    });

    it("returns 403 when reverting a mapping on another org's meeting", async () => {
      const meeting = await seedMeeting({
        organization: ORG_B,
        uploadedBy: mallory._id,
      });
      const mapping = await SpeakerMapping.create({
        meeting: meeting._id,
        organization: ORG_B,
        originalLabel: "Speaker X",
        mappedName: "Secret",
        createdBy: mallory._id,
        isConfirmed: true,
      });

      currentUser = alice;
      const res = await request(app).delete(
        `/api/speaker-mappings/${meeting._id}/${mapping._id}`,
      );

      expect(res.status).toBe(403);
      expect(mockApplyMapping).not.toHaveBeenCalled();
      expect(await SpeakerMapping.findById(mapping._id)).not.toBeNull();
    });
  });

  describe("missing meeting and forbidden roles", () => {
    it("returns 404 when the meeting does not exist", async () => {
      const missingId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/speaker-mappings/${missingId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it("returns 403 when the user has no organization", async () => {
      const meeting = await seedMeeting({
        organization: ORG_A,
        uploadedBy: alice._id,
      });

      currentUser = noOrgUser;
      const res = await request(app).get(
        `/api/speaker-mappings/${meeting._id}`,
      );

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/organization membership/i);
    });

    it("returns 403 when a viewer tries to create/apply a mapping", async () => {
      const meeting = await seedMeeting({
        organization: ORG_A,
        uploadedBy: alice._id,
      });

      currentUser = aliceViewer;
      const res = await request(app)
        .post(`/api/speaker-mappings/${meeting._id}`)
        .send({ originalLabel: "Speaker A", mappedName: "Alice" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(mockApplyMapping).not.toHaveBeenCalled();
    });

    it("allows a viewer to read mappings (meetings.view)", async () => {
      const meeting = await seedMeeting({
        organization: ORG_A,
        uploadedBy: alice._id,
      });

      currentUser = aliceViewer;
      const res = await request(app).get(
        `/api/speaker-mappings/${meeting._id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 401 when unauthenticated", async () => {
      const meeting = await seedMeeting({
        organization: ORG_A,
        uploadedBy: alice._id,
      });

      currentUser = null;
      const res = await request(app).get(
        `/api/speaker-mappings/${meeting._id}`,
      );

      expect(res.status).toBe(401);
    });
  });
});
