/**
 * Regression tests for Issue #1276 — `getTopicsForMeeting` and `renameCluster`
 * resolved documents by id with no organization filter.
 *
 * One leaked another organization's extracted meeting topics (names, keywords,
 * discussion time ranges, plus the populated cluster labels); the other let any
 * authenticated user rewrite another organization's cluster labels and set
 * `isUserRenamed`, which stops the clustering job from ever correcting them.
 *
 * These mount the real router so the `:orgId` path-parameter behaviour is
 * covered as well.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

// ── Session injection ──────────────────────────────────────────────────────
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

// ── AI / embedding stubs ───────────────────────────────────────────────────
// The authorization checks under test all run before these are reached. The
// stubs let the extraction test assert that the transcript never got as far as
// the model, rather than passing on a network failure.
const generateText = jest.fn();
const embedText = jest.fn();

jest.unstable_mockModule("../services/GenerativeAIService.js", () => ({
  generateText,
  parseJsonOutput: (text) => JSON.parse(text),
}));
jest.unstable_mockModule("../utils/embeddingUtils.js", () => ({
  embedText,
}));

const { default: topicRoutes } = await import("../routes/topicRoutes.js");
const { default: MeetingTopic } =
  await import("../models/meetingTopicModel.js");
const { default: TopicCluster } =
  await import("../models/topicClusterModel.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { default: Transcript } = await import("../models/transcriptModel.js");

await import("../models/userModel.js");
await import("../models/organizationModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const alice = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

/** Deliberately privileged, but in a different organization. */
const mallory = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
  role: "owner",
};

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }

  app = express();
  app.use(express.json());
  app.use("/api/topics", topicRoutes);
});

beforeEach(() => {
  currentUser = alice;
  generateText.mockReset();
  embedText.mockReset();
});

/** A meeting with one extracted topic, assigned to one cluster. */
const seedTopics = async (organization, owner) => {
  const meeting = await Meeting.create({
    uploadedBy: owner._id,
    organization,
    title: "Roadmap sync",
    date: new Date(),
    transcript: "We discussed the migration timeline at length.",
  });

  const cluster = await TopicCluster.create({
    organization,
    label: "Migration Planning",
    description: "Work relating to the platform migration",
    canonicalTopicNames: ["Migration Planning"],
    meetingCount: 1,
    centroidEmbedding: [0.1, 0.2, 0.3],
  });

  const meetingTopic = await MeetingTopic.create({
    organization,
    meeting: meeting._id,
    topics: [
      {
        name: "Migration timeline",
        confidence: 92,
        keywords: ["migration", "timeline", "cutover"],
        timeRanges: [{ start: 0, end: 45 }],
        embedding: [0.1, 0.2, 0.3],
        clusterId: cluster._id,
      },
    ],
  });

  return { meeting, cluster, meetingTopic };
};

// ───────────────────────────────────────────────────────────────────────────
describe("GET /meeting/:meetingId", () => {
  it("refuses a meeting in another organization", async () => {
    const { meeting } = await seedTopics(ORG_B, mallory);

    // Against `main`: 200, with org B's topic names, keywords and time ranges,
    // plus the populated cluster label.
    const res = await request(app)
      .get(`/api/topics/meeting/${meeting._id}`)
      .expect(403);

    expect(res.body.data).toBeUndefined();
  });

  it("still serves a meeting in the caller's organization", async () => {
    const { meeting } = await seedTopics(ORG_A, alice);

    const res = await request(app)
      .get(`/api/topics/meeting/${meeting._id}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Migration timeline");
    expect(res.body.data[0].clusterId.label).toBe("Migration Planning");
  });

  it("returns an empty list for an accessible meeting with no topics", async () => {
    const meeting = await Meeting.create({
      uploadedBy: alice._id,
      organization: ORG_A,
      title: "Untouched",
      date: new Date(),
    });

    const res = await request(app)
      .get(`/api/topics/meeting/${meeting._id}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
  });

  it("returns 404 for a meeting that does not exist", async () => {
    await request(app)
      .get(`/api/topics/meeting/${new mongoose.Types.ObjectId()}`)
      .expect(404);
  });

  it("returns 400 for a malformed id rather than 500", async () => {
    await request(app).get("/api/topics/meeting/not-an-object-id").expect(400);
  });
});

describe("PUT /clusters/:clusterId", () => {
  it("refuses a cluster in another organization and leaves it unmodified", async () => {
    const { cluster } = await seedTopics(ORG_B, mallory);

    // Against `main`: 200, and org B's dashboard shows the new label from then
    // on — `isUserRenamed` stops the clustering job correcting it.
    await request(app)
      .put(`/api/topics/clusters/${cluster._id}`)
      .send({ label: "Renamed by an outsider" })
      .expect(404);

    const stored = await TopicCluster.findById(cluster._id);
    expect(stored.label).toBe("Migration Planning");
    expect(stored.isUserRenamed).toBe(false);
  });

  it("still renames a cluster in the caller's organization", async () => {
    const { cluster } = await seedTopics(ORG_A, alice);

    const res = await request(app)
      .put(`/api/topics/clusters/${cluster._id}`)
      .send({ label: "  Platform Migration  " })
      .expect(200);

    expect(res.body.data.label).toBe("Platform Migration");
    expect(res.body.data.isUserRenamed).toBe(true);
  });

  it("rejects a missing label", async () => {
    const { cluster } = await seedTopics(ORG_A, alice);

    await request(app)
      .put(`/api/topics/clusters/${cluster._id}`)
      .send({})
      .expect(400);
  });

  it("rejects a whitespace-only label", async () => {
    const { cluster } = await seedTopics(ORG_A, alice);

    await request(app)
      .put(`/api/topics/clusters/${cluster._id}`)
      .send({ label: "   " })
      .expect(400);
  });

  it("rejects a non-string label", async () => {
    const { cluster } = await seedTopics(ORG_A, alice);

    // Against `main`: `if (!label)` passes for 42, which was then coerced to
    // the string "42" on save.
    await request(app)
      .put(`/api/topics/clusters/${cluster._id}`)
      .send({ label: 42 })
      .expect(400);

    const stored = await TopicCluster.findById(cluster._id);
    expect(stored.label).toBe("Migration Planning");
  });

  it("rejects an over-long label", async () => {
    const { cluster } = await seedTopics(ORG_A, alice);

    await request(app)
      .put(`/api/topics/clusters/${cluster._id}`)
      .send({ label: "x".repeat(500) })
      .expect(400);
  });

  it("returns 400 for a malformed cluster id", async () => {
    await request(app)
      .put("/api/topics/clusters/not-an-object-id")
      .send({ label: "x" })
      .expect(400);
  });
});

describe("GET /clusters/org/:orgId", () => {
  it("serves the caller's own clusters", async () => {
    await seedTopics(ORG_A, alice);

    const res = await request(app)
      .get(`/api/topics/clusters/org/${ORG_A}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].label).toBe("Migration Planning");
  });

  it("refuses another organization's id instead of quietly serving your own", async () => {
    await seedTopics(ORG_A, alice);
    await seedTopics(ORG_B, mallory);

    // Against `main`: 200 with ORG_A's clusters, under ORG_B's id. Misleading
    // rather than dangerous, but it is what invites the assumption that the
    // path parameter is what scopes the query.
    await request(app).get(`/api/topics/clusters/org/${ORG_B}`).expect(403);
  });

  it("refuses another organization's id on the clustering trigger too", async () => {
    await request(app)
      .post(`/api/topics/clusters/org/${ORG_B}/cluster`)
      .expect(403);
  });
});

describe("POST /extract/:meetingId", () => {
  it("returns 403, not 500, for a meeting in another organization", async () => {
    const { meeting } = await seedTopics(ORG_B, mallory);

    const res = await request(app)
      .post(`/api/topics/extract/${meeting._id}`)
      .expect(403);

    expect(res.body.error).toMatch(/unauthorized access to meeting/i);
    // The transcript never reached the model.
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns 404 for a meeting that does not exist", async () => {
    await request(app)
      .post(`/api/topics/extract/${new mongoose.Types.ObjectId()}`)
      .expect(404);
  });

  it("returns 404 when an accessible meeting has no transcript segments", async () => {
    const meeting = await Meeting.create({
      uploadedBy: alice._id,
      organization: ORG_A,
      title: "No transcript",
      date: new Date(),
    });

    await request(app).post(`/api/topics/extract/${meeting._id}`).expect(404);
  });

  it("extracts from the caller's own meeting", async () => {
    const meeting = await Meeting.create({
      uploadedBy: alice._id,
      organization: ORG_A,
      title: "Roadmap sync",
      date: new Date(),
    });
    await Transcript.create({
      meeting: meeting._id,
      segments: [
        {
          speaker: "Alice",
          text: "The migration timeline slips a week",
          startTime: 0,
          endTime: 12,
        },
      ],
    });

    generateText.mockResolvedValue(
      JSON.stringify([
        {
          name: "Migration timeline",
          confidence: 90,
          keywords: ["migration"],
          timeRanges: [{ start: 0, end: 12 }],
        },
      ]),
    );
    embedText.mockResolvedValue([0.1, 0.2, 0.3]);

    const res = await request(app)
      .post(`/api/topics/extract/${meeting._id}`)
      .expect(200);

    expect(generateText).toHaveBeenCalled();
    expect(res.body.data.topics).toHaveLength(1);
    expect(res.body.data.organization).toBe(ORG_A.toString());
  });

  it("returns 400 for a malformed meeting id", async () => {
    await request(app).post("/api/topics/extract/not-an-object-id").expect(400);
  });
});

describe("baseline guards", () => {
  it("rejects an unauthenticated caller", async () => {
    currentUser = null;

    await request(app).get(`/api/topics/clusters/org/${ORG_A}`).expect(401);
  });

  it("rejects a caller with no organization", async () => {
    const { meeting } = await seedTopics(ORG_A, alice);
    currentUser = {
      _id: new mongoose.Types.ObjectId(),
      organization: null,
      role: "member",
    };

    await request(app).get(`/api/topics/meeting/${meeting._id}`).expect(403);
  });
});
