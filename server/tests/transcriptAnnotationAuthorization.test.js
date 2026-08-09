/**
 * Regression tests for Issue #1274 — four of the five transcript-annotation
 * endpoints performed no meeting-scoped authorization.
 *
 * Only `GET /meeting/:meetingId` was protected, by `requireOrgAccess(Meeting)`
 * in the route file. `POST /`, `PUT /:id`, `DELETE /:id` and
 * `PATCH /:id/resolve` had nothing: any authenticated user could annotate,
 * edit, delete and resolve on any organization's transcript given only an id.
 *
 * These mount the real router. The missing checks were spread across the route
 * file and the controller, and the surviving author check was wrong in a way
 * that only shows up with a *foreign* admin — a shape a handler-level test with
 * one hand-built user would not naturally produce.
 *
 * Confirmed load-bearing: 8 of the 24 fail against `main` — every cross-tenant
 * case (create, resolve, delete, and the foreign-admin edit), both moderation
 * cases the old role check wrongly refused, the 500 on a malformed author
 * filter, and the missing organization-membership guard. The other 16 assert
 * behaviour that was already correct and must stay that way.
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

const { default: annotationRoutes } =
  await import("../routes/transcriptAnnotationRoutes.js");
const { default: TranscriptAnnotation } =
  await import("../models/transcriptAnnotationModel.js");
const { default: Transcript } = await import("../models/transcriptModel.js");
const { default: Meeting } = await import("../models/meetingModel.js");

await import("../models/userModel.js");
await import("../models/organizationModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

/** Author of the seeded annotation, in org A. */
const alice = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

/** Colleague of alice — same organization, ordinary member. */
const bob = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

/** Owner of org A. Strictly more privileged than an admin, yet the old check
 *  accepted only the literal string "admin", so this user could not moderate. */
const aliceOwner = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "owner",
};

/** Org B's own admin. Uploads the org-B meeting used below. */
const mallory = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
  role: "admin",
};

/**
 * An admin of org A, unrelated to org B's meetings — neither their uploader nor
 * a member of their organization. The old check accepted this user for org B's
 * annotations purely on the strength of the string "admin".
 */
const carolAdmin = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "admin",
};

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }

  app = express();
  app.use(express.json());
  app.use("/api/transcript-annotations", annotationRoutes);
});

beforeEach(() => {
  currentUser = alice;
});

/** An org-A meeting with a transcript and one annotation authored by alice. */
const seedOrgA = async () => {
  const meeting = await Meeting.create({
    uploadedBy: alice._id,
    organization: ORG_A,
    title: "Sprint review",
    date: new Date(),
  });

  const transcript = await Transcript.create({
    meeting: meeting._id,
    segments: [{ speaker: "Alice", text: "Ship it", startTime: 0, endTime: 5 }],
  });

  const annotation = await TranscriptAnnotation.create({
    transcript: transcript._id,
    meeting: meeting._id,
    author: alice._id,
    type: "comment",
    body: "Worth revisiting",
    startTime: 0,
    endTime: 5,
  });

  return { meeting, transcript, annotation };
};

/** The same shape, but owned entirely by org B. */
const seedOrgB = async () => {
  const meeting = await Meeting.create({
    uploadedBy: mallory._id,
    organization: ORG_B,
    title: "Confidential planning",
    date: new Date(),
  });

  const transcript = await Transcript.create({
    meeting: meeting._id,
    segments: [
      { speaker: "Mallory", text: "Internal only", startTime: 0, endTime: 5 },
    ],
  });

  const annotation = await TranscriptAnnotation.create({
    transcript: transcript._id,
    meeting: meeting._id,
    author: mallory._id,
    type: "comment",
    body: "Org B private note",
    startTime: 0,
    endTime: 5,
  });

  return { meeting, transcript, annotation };
};

// ───────────────────────────────────────────────────────────────────────────
describe("POST / — creating an annotation", () => {
  it("refuses a meeting the caller cannot access, and persists nothing", async () => {
    const { meeting, transcript } = await seedOrgB();
    const before = await TranscriptAnnotation.countDocuments();

    // Against `main`: 201. The annotation then rendered in org B's viewer.
    await request(app)
      .post("/api/transcript-annotations")
      .send({
        transcript: transcript._id.toString(),
        meeting: meeting._id.toString(),
        type: "comment",
        body: "injected",
        startTime: 0,
        endTime: 1,
      })
      .expect(403);

    expect(await TranscriptAnnotation.countDocuments()).toBe(before);
  });

  it("still allows an annotation on the caller's own meeting", async () => {
    const { meeting, transcript } = await seedOrgA();

    const res = await request(app)
      .post("/api/transcript-annotations")
      .send({
        transcript: transcript._id.toString(),
        meeting: meeting._id.toString(),
        type: "highlight",
        startTime: 1,
        endTime: 3,
      })
      .expect(201);

    expect(res.body.annotation.author).toBe(alice._id.toString());
  });

  it("still rejects a transcript that belongs to a different meeting", async () => {
    const { meeting } = await seedOrgA();
    const other = await seedOrgA();

    await request(app)
      .post("/api/transcript-annotations")
      .send({
        transcript: other.transcript._id.toString(),
        meeting: meeting._id.toString(),
        type: "comment",
        body: "mismatched",
        startTime: 0,
        endTime: 1,
      })
      .expect(400);
  });

  it("rejects malformed ids with 400 rather than 500", async () => {
    await request(app)
      .post("/api/transcript-annotations")
      .send({
        transcript: "not-an-id",
        meeting: "also-not-an-id",
        type: "comment",
        body: "x",
        startTime: 0,
        endTime: 1,
      })
      .expect(400);
  });

  it("still rejects startTime after endTime", async () => {
    const { meeting, transcript } = await seedOrgA();

    await request(app)
      .post("/api/transcript-annotations")
      .send({
        transcript: transcript._id.toString(),
        meeting: meeting._id.toString(),
        type: "comment",
        body: "backwards",
        startTime: 10,
        endTime: 5,
      })
      .expect(400);
  });
});

describe("PATCH /:id/resolve", () => {
  it("refuses an annotation in another organization", async () => {
    const { annotation } = await seedOrgB();

    // Against `main`: 200, with alice recorded as the resolver.
    await request(app)
      .patch(`/api/transcript-annotations/${annotation._id}/resolve`)
      .expect(404);

    const stored = await TranscriptAnnotation.findById(annotation._id);
    expect(stored.resolved).toBe(false);
    expect(stored.resolvedBy).toBeNull();
  });

  it("lets any member of the owning organization resolve", async () => {
    const { annotation } = await seedOrgA();
    currentUser = bob;

    await request(app)
      .patch(`/api/transcript-annotations/${annotation._id}/resolve`)
      .expect(200);

    const stored = await TranscriptAnnotation.findById(annotation._id);
    expect(stored.resolved).toBe(true);
    expect(stored.resolvedBy.toString()).toBe(bob._id.toString());
  });

  it("toggles back on a second call", async () => {
    const { annotation } = await seedOrgA();

    await request(app)
      .patch(`/api/transcript-annotations/${annotation._id}/resolve`)
      .expect(200);
    await request(app)
      .patch(`/api/transcript-annotations/${annotation._id}/resolve`)
      .expect(200);

    const stored = await TranscriptAnnotation.findById(annotation._id);
    expect(stored.resolved).toBe(false);
    expect(stored.resolvedBy).toBeNull();
  });
});

describe("PUT /:id", () => {
  it("refuses a foreign admin and leaves the annotation intact", async () => {
    const { annotation } = await seedOrgB();
    currentUser = carolAdmin;

    // Against `main`: 200 — `req.user.role === "admin"` passed, even though the
    // annotation belongs to an organization this admin has nothing to do with.
    await request(app)
      .put(`/api/transcript-annotations/${annotation._id}`)
      .send({ body: "rewritten" })
      .expect(404);

    const stored = await TranscriptAnnotation.findById(annotation._id);
    expect(stored.body).toBe("Org B private note");
  });

  it("lets the author edit their own annotation", async () => {
    const { annotation } = await seedOrgA();

    const res = await request(app)
      .put(`/api/transcript-annotations/${annotation._id}`)
      .send({ body: "revised" })
      .expect(200);

    expect(res.body.annotation.body).toBe("revised");
  });

  it("refuses an ordinary colleague who is not the author", async () => {
    const { annotation } = await seedOrgA();
    currentUser = bob;

    await request(app)
      .put(`/api/transcript-annotations/${annotation._id}`)
      .send({ body: "not mine" })
      .expect(403);

    const stored = await TranscriptAnnotation.findById(annotation._id);
    expect(stored.body).toBe("Worth revisiting");
  });

  it("lets an owner of the annotation's own organization moderate", async () => {
    const { annotation } = await seedOrgA();
    currentUser = aliceOwner;

    // Against `main`: 403 — only the literal role "admin" was accepted, so an
    // org owner could not moderate their own organization's annotations.
    await request(app)
      .put(`/api/transcript-annotations/${annotation._id}`)
      .send({ body: "moderated" })
      .expect(200);
  });

  it("returns 400 for a malformed id", async () => {
    await request(app)
      .put("/api/transcript-annotations/not-an-object-id")
      .send({ body: "x" })
      .expect(400);
  });

  it("returns 404 for an id that does not exist", async () => {
    await request(app)
      .put(`/api/transcript-annotations/${new mongoose.Types.ObjectId()}`)
      .send({ body: "x" })
      .expect(404);
  });
});

describe("DELETE /:id", () => {
  it("refuses a caller from another organization", async () => {
    const { annotation } = await seedOrgB();

    await request(app)
      .delete(`/api/transcript-annotations/${annotation._id}`)
      .expect(404);

    expect(await TranscriptAnnotation.findById(annotation._id)).not.toBeNull();
  });

  it("lets the author delete their own annotation", async () => {
    const { annotation } = await seedOrgA();

    await request(app)
      .delete(`/api/transcript-annotations/${annotation._id}`)
      .expect(200);

    expect(await TranscriptAnnotation.findById(annotation._id)).toBeNull();
  });

  it("refuses an ordinary colleague", async () => {
    const { annotation } = await seedOrgA();
    currentUser = bob;

    await request(app)
      .delete(`/api/transcript-annotations/${annotation._id}`)
      .expect(403);

    expect(await TranscriptAnnotation.findById(annotation._id)).not.toBeNull();
  });

  it("lets a moderator of the owning organization delete", async () => {
    const { annotation } = await seedOrgA();
    currentUser = { ...bob, role: "moderator" };

    await request(app)
      .delete(`/api/transcript-annotations/${annotation._id}`)
      .expect(200);
  });
});

describe("GET /meeting/:meetingId", () => {
  it("still serves a member of the owning organization", async () => {
    const { meeting } = await seedOrgA();

    const res = await request(app)
      .get(`/api/transcript-annotations/meeting/${meeting._id}`)
      .expect(200);

    expect(res.body.annotations).toHaveLength(1);
  });

  it("still refuses a cross-organization caller", async () => {
    const { meeting } = await seedOrgB();

    await request(app)
      .get(`/api/transcript-annotations/meeting/${meeting._id}`)
      .expect(403);
  });

  it("returns 400 for a non-ObjectId author filter rather than 500", async () => {
    const { meeting } = await seedOrgA();

    await request(app)
      .get(`/api/transcript-annotations/meeting/${meeting._id}`)
      .query({ author: "not-an-object-id" })
      .expect(400);
  });

  it("filters by author when the value is valid", async () => {
    const { meeting } = await seedOrgA();

    const res = await request(app)
      .get(`/api/transcript-annotations/meeting/${meeting._id}`)
      .query({ author: bob._id.toString() })
      .expect(200);

    expect(res.body.annotations).toHaveLength(0);
  });
});

describe("baseline guards", () => {
  it("rejects an unauthenticated caller", async () => {
    currentUser = null;

    await request(app).post("/api/transcript-annotations").send({}).expect(401);
  });

  it("rejects a caller with no organization", async () => {
    currentUser = {
      _id: new mongoose.Types.ObjectId(),
      organization: null,
      role: "member",
    };

    await request(app).post("/api/transcript-annotations").send({}).expect(403);
  });
});
