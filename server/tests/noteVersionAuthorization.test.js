/**
 * Regression tests for Issue #1158 — the note-version API had no authorization.
 *
 * These run the real Express router (`routes/noteVersionRoutes.js`) mounted on
 * a bare app, rather than calling the handlers directly. That is the point: the
 * bug was *in the route definitions* — the handlers were reachable by anyone
 * because nothing stood in front of them. A test that invokes the controller
 * directly would have passed on the vulnerable code.
 *
 * Confirmed load-bearing: against `main`'s route file and controller, 14 of
 * these fail — every cross-tenant read, the cross-tenant restore, the
 * view-but-not-edit case, both diff-across-boundary cases, the unknown-field
 * and missing-meeting cases, pagination, and the CRDT persistence check.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

// ── Session injection ──────────────────────────────────────────────────────
// `userAuth` resolves a Clerk session, which is not what is under test here.
// It is replaced with a switch that injects whichever `req.user` the current
// test wants, so the suite exercises the *authorization* layer in isolation.
//
// The mock has to be registered before the router is loaded, so the router and
// everything downstream of it are imported dynamically below.
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

const { default: noteVersionRoutes } =
  await import("../routes/noteVersionRoutes.js");
const { default: NoteVersion } = await import("../models/noteVersionModel.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { default: errorHandler } = await import("../middleware/errorHandler.js");
const { snapshotNoteVersion } =
  await import("../controllers/noteVersionController.js");

// `changedBy` is `ref: "User"`. `server.js` loads every model at boot, so the
// schema is registered in production; this suite mounts one router, so it has
// to register it explicitly or `populate` throws MissingSchemaError.
await import("../models/userModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const alice = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};
const mallory = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
  role: "owner", // deliberately privileged — in her *own* organization
};
const viewerInOrgA = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "guest",
};

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }

  app = express();
  app.use(express.json());
  app.use("/api/note-versions", noteVersionRoutes);
  // The project's real error handler, so `ValidationError` and `NotFoundError`
  // map to the same statuses and bodies they would in production.
  app.use(errorHandler);
});

beforeEach(() => {
  currentUser = alice;
});

/** Creates an org-A meeting with two summary versions and one notes version. */
const seed = async () => {
  const meeting = await Meeting.create({
    uploadedBy: alice._id,
    organization: ORG_A,
    title: "Q3 Planning",
    date: new Date(),
    summary: "v2 summary",
    collaborativeNotes: "live notes",
  });

  const v1 = await snapshotNoteVersion(
    meeting._id,
    "summary",
    "v1 summary",
    "ai_processing",
    alice._id,
  );
  const v2 = await snapshotNoteVersion(
    meeting._id,
    "summary",
    "v2 summary",
    "user_edit",
    alice._id,
  );
  const n1 = await snapshotNoteVersion(
    meeting._id,
    "collaborativeNotes",
    "notes as typed",
    "user_edit",
    alice._id,
  );

  return { meeting, v1, v2, n1 };
};

// ───────────────────────────────────────────────────────────────────────────
describe("GET /:meetingId/:field/history", () => {
  it("serves the history to a member of the owning organization", async () => {
    const { meeting } = await seed();

    const res = await request(app)
      .get(`/api/note-versions/${meeting._id}/summary/history`)
      .expect(200);

    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0].version).toBe(2);
    // `-content` is still excluded, as before.
    expect(res.body.versions[0].content).toBeUndefined();
  });

  it("refuses a caller from another organization", async () => {
    const { meeting } = await seed();
    currentUser = mallory;

    // Against `main`: 200, with every version id and contributor email.
    await request(app)
      .get(`/api/note-versions/${meeting._id}/summary/history`)
      .expect(403);
  });

  it("refuses an unauthenticated caller", async () => {
    const { meeting } = await seed();
    currentUser = null;

    await request(app)
      .get(`/api/note-versions/${meeting._id}/summary/history`)
      .expect(401);
  });

  it("rejects an unknown field rather than reporting an empty history", async () => {
    const { meeting } = await seed();

    const res = await request(app)
      .get(`/api/note-versions/${meeting._id}/crdtState/history`)
      .expect(400);

    expect(res.body.message).toMatch(/Unknown versioned field/i);
  });

  it("rejects a malformed meeting id with 400, not 500", async () => {
    await request(app)
      .get("/api/note-versions/not-an-objectid/summary/history")
      .expect(400);
  });

  it("404s for a meeting that does not exist", async () => {
    await request(app)
      .get(
        `/api/note-versions/${new mongoose.Types.ObjectId()}/summary/history`,
      )
      .expect(404);
  });

  it("paginates instead of returning every version", async () => {
    const meeting = await Meeting.create({
      uploadedBy: alice._id,
      organization: ORG_A,
      title: "Long meeting",
      date: new Date(),
    });

    for (let i = 0; i < 30; i++) {
      await snapshotNoteVersion(
        meeting._id,
        "summary",
        `revision ${i}`,
        "user_edit",
        alice._id,
      );
    }

    const firstPage = await request(app)
      .get(`/api/note-versions/${meeting._id}/summary/history`)
      .expect(200);

    expect(firstPage.body.versions).toHaveLength(25); // default page size
    expect(firstPage.body.pagination).toMatchObject({
      total: 30,
      page: 1,
      limit: 25,
      hasMore: true,
    });

    const secondPage = await request(app)
      .get(`/api/note-versions/${meeting._id}/summary/history?page=2`)
      .expect(200);

    expect(secondPage.body.versions).toHaveLength(5);
    expect(secondPage.body.pagination.hasMore).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("GET /version/:versionId", () => {
  it("serves full content to a member of the owning organization", async () => {
    const { v1 } = await seed();

    const res = await request(app)
      .get(`/api/note-versions/version/${v1._id}`)
      .expect(200);

    expect(res.body.version.content).toBe("v1 summary");
  });

  it("refuses a caller from another organization", async () => {
    const { v1 } = await seed();
    currentUser = mallory;

    // Against `main`: 200 with the complete summary text.
    await request(app).get(`/api/note-versions/version/${v1._id}`).expect(404);
  });

  it("does not distinguish 'not yours' from 'does not exist'", async () => {
    const { v1 } = await seed();
    currentUser = mallory;

    const forbidden = await request(app).get(
      `/api/note-versions/version/${v1._id}`,
    );
    const missing = await request(app).get(
      `/api/note-versions/version/${new mongoose.Types.ObjectId()}`,
    );

    expect(forbidden.status).toBe(missing.status);
    expect(forbidden.body.message).toBe(missing.body.message);
  });

  it("rejects a malformed version id with 400, not 500", async () => {
    await request(app)
      .get("/api/note-versions/version/not-an-objectid")
      .expect(400);
  });

  it("refuses a caller with no organization on their session", async () => {
    const { v1 } = await seed();
    currentUser = { _id: new mongoose.Types.ObjectId(), role: "member" };

    await request(app).get(`/api/note-versions/version/${v1._id}`).expect(403);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("GET /version/:versionId/diff", () => {
  it("diffs against the preceding version by default", async () => {
    const { v2 } = await seed();

    const res = await request(app)
      .get(`/api/note-versions/version/${v2._id}/diff`)
      .expect(200);

    const added = res.body.diff.find((part) => part.added);
    expect(added.value).toContain("v2 summary");
  });

  it("refuses a caller from another organization", async () => {
    const { v2 } = await seed();
    currentUser = mallory;

    await request(app)
      .get(`/api/note-versions/version/${v2._id}/diff`)
      .expect(404);
  });

  it("refuses to diff across two different meetings", async () => {
    const { v1 } = await seed();

    const otherMeeting = await Meeting.create({
      uploadedBy: alice._id,
      organization: ORG_A,
      title: "Unrelated",
      date: new Date(),
    });
    const otherVersion = await snapshotNoteVersion(
      otherMeeting._id,
      "summary",
      "someone else's minutes",
      "user_edit",
      alice._id,
    );

    // Only `versionId` is access-checked, so without this guard the second id
    // is a free read of any version in the database — including another
    // organization's, since the diff output carries both sides.
    const res = await request(app)
      .get(`/api/note-versions/version/${v1._id}/diff/${otherVersion._id}`)
      .expect(400);

    expect(res.body.message).toMatch(/same meeting and field/i);
  });

  it("refuses to diff across two different fields of the same meeting", async () => {
    const { v1, n1 } = await seed();

    await request(app)
      .get(`/api/note-versions/version/${v1._id}/diff/${n1._id}`)
      .expect(400);
  });

  it("diffs two versions of the same meeting and field", async () => {
    const { v1, v2 } = await seed();

    const res = await request(app)
      .get(`/api/note-versions/version/${v2._id}/diff/${v1._id}`)
      .expect(200);

    expect(Array.isArray(res.body.diff)).toBe(true);
  });

  it("rejects a malformed comparison id with 400", async () => {
    const { v1 } = await seed();

    await request(app)
      .get(`/api/note-versions/version/${v1._id}/diff/not-an-objectid`)
      .expect(400);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("POST /version/:versionId/restore", () => {
  it("restores a summary for an authorized caller", async () => {
    const { meeting, v1 } = await seed();

    await request(app)
      .post(`/api/note-versions/version/${v1._id}/restore`)
      .expect(200);

    const reloaded = await Meeting.findById(meeting._id);
    expect(reloaded.summary).toBe("v1 summary");
  });

  it("refuses a cross-tenant restore", async () => {
    const { meeting, v1 } = await seed();
    currentUser = mallory;

    // Against `main`: 200, and org A's live summary silently reverts.
    await request(app)
      .post(`/api/note-versions/version/${v1._id}/restore`)
      .expect(404);

    const reloaded = await Meeting.findById(meeting._id);
    expect(reloaded.summary).toBe("v2 summary"); // untouched
  });

  it("refuses a caller who may view but not edit", async () => {
    const { meeting, v1 } = await seed();
    currentUser = viewerInOrgA;

    // Reading is fine for this role...
    await request(app).get(`/api/note-versions/version/${v1._id}`).expect(200);
    // ...restoring is not.
    await request(app)
      .post(`/api/note-versions/version/${v1._id}/restore`)
      .expect(403);

    const reloaded = await Meeting.findById(meeting._id);
    expect(reloaded.summary).toBe("v2 summary");
  });

  it("rebuilds crdtState so a notes restore is not reverted by the next sync", async () => {
    const { meeting, n1 } = await seed();

    // Simulate a document that has been edited since — a stale CRDT blob that
    // `getOrCreateDoc` would otherwise rehydrate over the restored text.
    await Meeting.findByIdAndUpdate(meeting._id, {
      crdtState: Buffer.from([1, 2, 3]),
      collaborativeNotes: "text typed after the snapshot",
    });

    await request(app)
      .post(`/api/note-versions/version/${n1._id}/restore`)
      .expect(200);

    const reloaded = await Meeting.findById(meeting._id);
    expect(reloaded.collaborativeNotes).toBe("notes as typed");

    // The blob must have been replaced, and must decode back to the restored
    // text — asserting it merely changed would pass on any garbage write.
    const Y = await import("yjs");
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, new Uint8Array(reloaded.crdtState));
    expect(ydoc.getText("notes").toString()).toBe("notes as typed");
  });

  it("writes a new snapshot attributing the restore to the caller", async () => {
    const { meeting, v1 } = await seed();

    await request(app)
      .post(`/api/note-versions/version/${v1._id}/restore`)
      .expect(200);

    const latest = await NoteVersion.findOne({
      meetingId: meeting._id,
      field: "summary",
    }).sort({ version: -1 });

    expect(latest.version).toBe(3);
    expect(latest.content).toBe("v1 summary");
    expect(latest.changedBy.toString()).toBe(alice._id.toString());
  });

  it("404s for an unknown version id", async () => {
    await request(app)
      .post(
        `/api/note-versions/version/${new mongoose.Types.ObjectId()}/restore`,
      )
      .expect(404);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("meeting-owner access", () => {
  it("lets the uploader through even without an organization match", async () => {
    // `canAccessMeetingDoc` accepts owner *or* same-org, and this is the owner
    // branch — a meeting created before the uploader joined an organization.
    const meeting = await Meeting.create({
      uploadedBy: mallory._id,
      organization: null,
      title: "Personal notes",
      date: new Date(),
    });

    const version = await snapshotNoteVersion(
      meeting._id,
      "summary",
      "mine",
      "user_edit",
      mallory._id,
    );

    currentUser = mallory;
    const res = await request(app)
      .get(`/api/note-versions/version/${version._id}`)
      .expect(200);

    expect(res.body.version.content).toBe("mine");

    // ...and still refuses everyone else.
    currentUser = alice;
    await request(app)
      .get(`/api/note-versions/version/${version._id}`)
      .expect(404);
  });
});
