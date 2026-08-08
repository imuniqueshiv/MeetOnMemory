/**
 * Regression tests for Issue #1273 — the glossary API wrote the raw request
 * body into a `$set`, extracted from any meeting in the database, and applied
 * no RBAC to its write routes.
 *
 * These mount the real `routes/glossaryRoutes.js`. Two of the three faults were
 * properties of the route file or of the body-to-document path, so a test that
 * called `updateTerm(req, res)` with a hand-built request would not have caught
 * them.
 *
 * Confirmed load-bearing: 16 of the 24 fail against `main`.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

// ── Session injection ──────────────────────────────────────────────────────
// Replaces Clerk session resolution so each test can choose its own caller.
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

// ── AI stub ────────────────────────────────────────────────────────────────
// `aiExtractTerms` calls a live model. The authorization check under test runs
// *before* that call, so the stub exists to prove the point: if extraction is
// ever reached for a foreign meeting, `generateText` records the transcript it
// was handed and the assertion fails loudly rather than silently passing on a
// network error.
const generateText = jest.fn();

jest.unstable_mockModule("../services/GenerativeAIService.js", () => ({
  generateText,
  parseJsonOutput: (text) => JSON.parse(text),
}));

const { default: glossaryRoutes } = await import("../routes/glossaryRoutes.js");
const { default: GlossaryTerm } =
  await import("../models/glossaryTermModel.js");
const { default: Meeting } = await import("../models/meetingModel.js");

await import("../models/userModel.js");
await import("../models/organizationModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const alice = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

/** Deliberately privileged, but in a *different* organization. */
const mallory = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
  role: "owner",
};

const viewer = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "viewer",
};

const moderator = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "moderator",
};

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }

  app = express();
  app.use(express.json());
  app.use("/api/glossary", glossaryRoutes);
});

beforeEach(() => {
  currentUser = alice;
  generateText.mockReset();
});

const seedTerm = (overrides = {}) =>
  GlossaryTerm.create({
    organization: ORG_A,
    term: "ROI",
    definition: "Return on Investment",
    aliases: ["Return On Investment"],
    category: "Finance",
    approvalStatus: "approved",
    ...overrides,
  });

const seedMeeting = (organization, transcript) =>
  Meeting.create({
    uploadedBy: organization === ORG_A ? alice._id : mallory._id,
    organization,
    title: "Quarterly review",
    date: new Date(),
    transcript,
  });

// ───────────────────────────────────────────────────────────────────────────
describe("PUT /:id — mass assignment", () => {
  it("cannot move a term into another organization", async () => {
    const term = await seedTerm();

    // Against `main`: 200, and the term is now owned by ORG_B.
    await request(app)
      .put(`/api/glossary/${term._id}`)
      .send({ definition: "Updated", organization: ORG_B.toString() })
      .expect(400);

    const stored = await GlossaryTerm.findById(term._id);
    expect(stored.organization.toString()).toBe(ORG_A.toString());
    // The whole write is rejected, not partially applied.
    expect(stored.definition).toBe("Return on Investment");
  });

  it("cannot set approvalStatus, bypassing the approve endpoint", async () => {
    const term = await seedTerm({
      approvalStatus: "pending",
      isAutoSuggested: true,
    });

    await request(app)
      .put(`/api/glossary/${term._id}`)
      .send({ approvalStatus: "approved" })
      .expect(400);

    const stored = await GlossaryTerm.findById(term._id);
    expect(stored.approvalStatus).toBe("pending");
  });

  it("cannot set usageCount or isAutoSuggested", async () => {
    const term = await seedTerm();

    await request(app)
      .put(`/api/glossary/${term._id}`)
      .send({ usageCount: 9999, isAutoSuggested: true })
      .expect(400);

    const stored = await GlossaryTerm.findById(term._id);
    expect(stored.usageCount).toBe(0);
    expect(stored.isAutoSuggested).toBe(false);
  });

  it("still applies a legitimate update", async () => {
    const term = await seedTerm();

    const res = await request(app)
      .put(`/api/glossary/${term._id}`)
      .send({ definition: "Return on Invested Capital", category: "Metrics" })
      .expect(200);

    expect(res.body.definition).toBe("Return on Invested Capital");
    expect(res.body.category).toBe("Metrics");
    expect(res.body.term).toBe("ROI");
  });

  it("rejects a rename that collides with an existing term", async () => {
    await seedTerm({ term: "KPI", definition: "Key Performance Indicator" });
    const term = await seedTerm();

    await request(app)
      .put(`/api/glossary/${term._id}`)
      .send({ term: "kpi" })
      .expect(400);
  });

  it("allows a term to be renamed to a different case of itself", async () => {
    const term = await seedTerm();

    await request(app)
      .put(`/api/glossary/${term._id}`)
      .send({ term: "roi" })
      .expect(200);
  });

  it("rejects an empty body rather than issuing a no-op write", async () => {
    const term = await seedTerm();

    await request(app).put(`/api/glossary/${term._id}`).send({}).expect(400);
  });

  it("does not reach another organization's term", async () => {
    const term = await seedTerm({ organization: ORG_B });

    await request(app)
      .put(`/api/glossary/${term._id}`)
      .send({ definition: "Hijacked" })
      .expect(404);

    const stored = await GlossaryTerm.findById(term._id);
    expect(stored.definition).toBe("Return on Investment");
  });

  it("rejects a malformed id with 400 rather than 500", async () => {
    await request(app)
      .put("/api/glossary/not-an-object-id")
      .send({ definition: "x" })
      .expect(400);
  });
});

describe("POST / — input validation", () => {
  it("rejects a non-array aliases value", async () => {
    await request(app)
      .post("/api/glossary")
      .send({
        term: "SLA",
        definition: "Service Level Agreement",
        aliases: "nope",
      })
      .expect(400);

    expect(await GlossaryTerm.countDocuments()).toBe(0);
  });

  it("rejects an over-long definition", async () => {
    await request(app)
      .post("/api/glossary")
      .send({ term: "SLA", definition: "x".repeat(5000) })
      .expect(400);
  });

  it("rejects unknown fields instead of silently dropping them", async () => {
    await request(app)
      .post("/api/glossary")
      .send({
        term: "SLA",
        definition: "Service Level Agreement",
        organization: ORG_B.toString(),
      })
      .expect(400);
  });

  it("still creates a valid term in the caller's organization", async () => {
    const res = await request(app)
      .post("/api/glossary")
      .send({
        term: "SLA",
        definition: "Service Level Agreement",
        aliases: ["Service Level"],
      })
      .expect(201);

    expect(res.body.organization).toBe(ORG_A.toString());
    expect(res.body.approvalStatus).toBe("approved");
  });
});

describe("POST /extract — meeting organization", () => {
  it("refuses a meeting belonging to another organization", async () => {
    const meeting = await seedMeeting(ORG_B, "The K8s cluster needs scaling.");

    // Against `main`: 200, with terms mined from ORG_B's transcript and
    // persisted under ORG_A.
    const res = await request(app)
      .post("/api/glossary/extract")
      .send({ meetingId: meeting._id.toString() })
      .expect(403);

    expect(res.body.message).toMatch(/unauthorized access to meeting/i);
    // The transcript never reached the model.
    expect(generateText).not.toHaveBeenCalled();
    // And nothing was written into the caller's glossary.
    expect(await GlossaryTerm.countDocuments()).toBe(0);
  });

  it("returns 404 for a meeting that does not exist", async () => {
    await request(app)
      .post("/api/glossary/extract")
      .send({ meetingId: new mongoose.Types.ObjectId().toString() })
      .expect(404);
  });

  it("rejects a malformed meetingId with 400", async () => {
    await request(app)
      .post("/api/glossary/extract")
      .send({ meetingId: "not-an-object-id" })
      .expect(400);
  });

  it("extracts from the caller's own meeting", async () => {
    const meeting = await seedMeeting(ORG_A, "The K8s cluster needs scaling.");
    generateText.mockResolvedValue(
      JSON.stringify([
        { term: "K8s", definition: "Kubernetes", category: "Engineering" },
      ]),
    );

    const res = await request(app)
      .post("/api/glossary/extract")
      .send({ meetingId: meeting._id.toString() })
      .expect(200);

    expect(generateText).toHaveBeenCalled();
    expect(res.body).toHaveLength(1);
    expect(res.body[0].term).toBe("K8s");
    expect(res.body[0].organization).toBe(ORG_A.toString());
    expect(res.body[0].approvalStatus).toBe("pending");
  });
});

describe("role permissions", () => {
  it("lets a viewer read the glossary", async () => {
    await seedTerm();
    currentUser = viewer;

    const res = await request(app).get("/api/glossary").expect(200);
    expect(res.body).toHaveLength(1);
  });

  it("refuses a viewer creating a term", async () => {
    currentUser = viewer;

    await request(app)
      .post("/api/glossary")
      .send({ term: "SLA", definition: "Service Level Agreement" })
      .expect(403);

    expect(await GlossaryTerm.countDocuments()).toBe(0);
  });

  it("refuses a viewer deleting a term", async () => {
    const term = await seedTerm();
    currentUser = viewer;

    await request(app).delete(`/api/glossary/${term._id}`).expect(403);

    expect(await GlossaryTerm.findById(term._id)).not.toBeNull();
  });

  it("refuses a viewer approving a pending term", async () => {
    const term = await seedTerm({ approvalStatus: "pending" });
    currentUser = viewer;

    await request(app).post(`/api/glossary/${term._id}/approve`).expect(403);

    const stored = await GlossaryTerm.findById(term._id);
    expect(stored.approvalStatus).toBe("pending");
  });

  it("allows a moderator to approve and delete", async () => {
    const pending = await seedTerm({ term: "MTTR", approvalStatus: "pending" });
    currentUser = moderator;

    await request(app).post(`/api/glossary/${pending._id}/approve`).expect(200);
    await request(app).delete(`/api/glossary/${pending._id}`).expect(200);
  });

  it("rejects a caller with no organization", async () => {
    currentUser = {
      _id: new mongoose.Types.ObjectId(),
      organization: null,
      role: "member",
    };

    await request(app).get("/api/glossary").expect(403);
  });

  it("rejects an unauthenticated caller", async () => {
    currentUser = null;

    await request(app).get("/api/glossary").expect(401);
  });
});
