/**
 * Regression tests for Issue #1275 — `cloneTemplate` was the only handler in
 * the template library that resolved a document by id without scoping it to
 * the caller's organization.
 *
 * `publishTemplate`, `browseTemplates` and `rateTemplate` all filter on
 * `organizationId`; `cloneTemplate` used a bare `findById`, and read
 * `organizationId` from the caller only to decide where the copy should land.
 * The source was whatever `:id` pointed at.
 *
 * The suite also covers the snapshot-fidelity and pagination problems that sit
 * alongside it, since all three live in the same two functions.
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

const { default: templateLibraryRoutes } =
  await import("../routes/templateLibraryRoutes.js");
const { default: TemplateLibrary } =
  await import("../models/templateLibraryModel.js");
const { default: MeetingTemplate } =
  await import("../models/meetingTemplateModel.js");

await import("../models/userModel.js");
await import("../models/organizationModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const alice = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

const bob = {
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
  app.use("/api/template-library", templateLibraryRoutes);
});

beforeEach(() => {
  currentUser = alice;
});

/** A source template plus the library entry published from it. */
const seedPublished = async (organizationId, publisher, overrides = {}) => {
  const source = await MeetingTemplate.create({
    organizationId,
    name: "Sprint Planning",
    title: "Sprint Planning Session",
    description: "Plan the next two weeks",
    category: "Engineering",
    defaultDuration: 45,
    agendaBlocks: [
      { title: "Capacity", description: "Who is available", duration: 10 },
      { title: "Backlog", description: "Groom the top items", duration: 35 },
    ],
    defaultParticipants: ["eng@example.com", "pm@example.com"],
    createdBy: publisher._id,
    ...overrides,
  });

  const entry = await TemplateLibrary.create({
    organizationId,
    originalTemplateId: source._id,
    name: source.name,
    title: source.title,
    description: source.description,
    category: source.category,
    defaultDuration: source.defaultDuration,
    agendaBlocks: source.agendaBlocks,
    defaultParticipants: source.defaultParticipants,
    publishedBy: publisher._id,
  });

  return { source, entry };
};

// ───────────────────────────────────────────────────────────────────────────
describe("POST /:id/clone — organization scoping", () => {
  it("refuses another organization's library entry", async () => {
    const { entry } = await seedPublished(ORG_B, mallory);

    // Against `main`: 201, with org B's template content copied into org A.
    await request(app)
      .post(`/api/template-library/${entry._id}/clone`)
      .expect(404);

    expect(
      await MeetingTemplate.countDocuments({ organizationId: ORG_A }),
    ).toBe(0);
  });

  it("does not increment the victim's clone count", async () => {
    const { entry } = await seedPublished(ORG_B, mallory);

    await request(app)
      .post(`/api/template-library/${entry._id}/clone`)
      .expect(404);

    const stored = await TemplateLibrary.findById(entry._id);
    expect(stored.cloneCount).toBe(0);
  });

  it("still clones an entry from the caller's own organization", async () => {
    const { entry } = await seedPublished(ORG_A, bob);

    const res = await request(app)
      .post(`/api/template-library/${entry._id}/clone`)
      .expect(201);

    expect(res.body.name).toBe("Sprint Planning (Clone)");
    expect(res.body.organizationId).toBe(ORG_A.toString());
    expect(res.body.createdBy).toBe(alice._id.toString());

    const stored = await TemplateLibrary.findById(entry._id);
    expect(stored.cloneCount).toBe(1);
  });

  it("rejects a malformed id with 400 rather than 500", async () => {
    await request(app)
      .post("/api/template-library/not-an-object-id/clone")
      .expect(400);
  });
});

describe("POST /:id/clone — snapshot fidelity", () => {
  it("copies every published field, including defaultParticipants", async () => {
    const { entry } = await seedPublished(ORG_A, bob);

    const res = await request(app)
      .post(`/api/template-library/${entry._id}/clone`)
      .expect(201);

    expect(res.body.title).toBe("Sprint Planning Session");
    expect(res.body.description).toBe("Plan the next two weeks");
    expect(res.body.category).toBe("Engineering");
    expect(res.body.defaultDuration).toBe(45);
    expect(res.body.agendaBlocks).toHaveLength(2);
    // Against `main`: [] — the clone never copied defaultParticipants.
    expect(res.body.defaultParticipants).toEqual([
      "eng@example.com",
      "pm@example.com",
    ]);
  });

  it("reproduces what was published, not later edits to the source", async () => {
    const { source, entry } = await seedPublished(ORG_A, bob);

    source.title = "Completely different meeting";
    source.defaultDuration = 5;
    await source.save();

    const res = await request(app)
      .post(`/api/template-library/${entry._id}/clone`)
      .expect(201);

    // Against `main`: the clone silently picked up the edited source, so the
    // user received something other than the entry they browsed and rated.
    expect(res.body.title).toBe("Sprint Planning Session");
    expect(res.body.defaultDuration).toBe(45);
  });

  it("still clones after the source template has been deleted", async () => {
    const { source, entry } = await seedPublished(ORG_A, bob);
    await MeetingTemplate.findByIdAndDelete(source._id);

    // Against `main`: 404 "Original template not found", even though the
    // library entry holds everything the clone needs.
    const res = await request(app)
      .post(`/api/template-library/${entry._id}/clone`)
      .expect(201);

    expect(res.body.title).toBe("Sprint Planning Session");
  });

  it("records which library entry the clone came from", async () => {
    const { entry } = await seedPublished(ORG_A, bob);

    const res = await request(app)
      .post(`/api/template-library/${entry._id}/clone`)
      .expect(201);

    // Against `main`: undefined. The old code wrote provenance into a
    // `metadata` object that the schema never declared, so Mongoose's strict
    // mode discarded it on save without complaint.
    expect(res.body.clonedFromLibraryId).toBe(entry._id.toString());
  });
});

describe("GET / — pagination", () => {
  const seedMany = async (count) => {
    for (let i = 0; i < count; i += 1) {
      await TemplateLibrary.create({
        organizationId: ORG_A,
        originalTemplateId: new mongoose.Types.ObjectId(),
        name: `Template ${i}`,
        title: `Title ${i}`,
        publishedBy: bob._id,
      });
    }
  };

  it("clamps an absurd limit", async () => {
    await seedMany(5);

    // Against `main`: honoured verbatim and passed straight to `.limit()`.
    const res = await request(app)
      .get("/api/template-library")
      .query({ limit: 1000000 })
      .expect(200);

    expect(res.body.pagination.limit).toBeLessThanOrEqual(50);
    expect(res.body.templates).toHaveLength(5);
  });

  it("falls back to defaults for non-numeric page and limit", async () => {
    await seedMany(3);

    // Against `main`: `skip: NaN`, which Mongoose rejects.
    const res = await request(app)
      .get("/api/template-library")
      .query({ page: "abc", limit: "xyz" })
      .expect(200);

    expect(res.body.currentPage).toBe(1);
    expect(res.body.templates).toHaveLength(3);
  });

  it("keeps the response keys the client reads", async () => {
    await seedMany(3);

    const res = await request(app).get("/api/template-library").expect(200);

    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.currentPage).toBe(1);
  });

  it("never lists another organization's entries", async () => {
    await seedPublished(ORG_B, mallory);
    await seedMany(2);

    const res = await request(app).get("/api/template-library").expect(200);

    expect(res.body.templates).toHaveLength(2);
  });
});

describe("POST /:id/rate — validation", () => {
  it("rejects a missing rating", async () => {
    const { entry } = await seedPublished(ORG_A, bob);

    // Against `main`: `undefined < 1` is false and `undefined > 5` is false, so
    // this passed the guard and failed later as a 500.
    await request(app)
      .post(`/api/template-library/${entry._id}/rate`)
      .send({ review: "Nice" })
      .expect(400);
  });

  it("rejects a numeric string rating", async () => {
    const { entry } = await seedPublished(ORG_A, bob);

    await request(app)
      .post(`/api/template-library/${entry._id}/rate`)
      .send({ rating: "3" })
      .expect(400);
  });

  it("rejects an out-of-range rating", async () => {
    const { entry } = await seedPublished(ORG_A, bob);

    await request(app)
      .post(`/api/template-library/${entry._id}/rate`)
      .send({ rating: 9 })
      .expect(400);
  });

  it("still accepts a valid rating and recomputes the average", async () => {
    const { entry } = await seedPublished(ORG_A, bob);

    await request(app)
      .post(`/api/template-library/${entry._id}/rate`)
      .send({ rating: 4, review: "Solid" })
      .expect(200);

    currentUser = bob;
    const res = await request(app)
      .post(`/api/template-library/${entry._id}/rate`)
      .send({ rating: 2 })
      .expect(200);

    expect(res.body.ratings).toHaveLength(2);
    expect(res.body.averageRating).toBe(3);
  });

  it("refuses to rate another organization's entry", async () => {
    const { entry } = await seedPublished(ORG_B, mallory);

    await request(app)
      .post(`/api/template-library/${entry._id}/rate`)
      .send({ rating: 1 })
      .expect(404);

    const stored = await TemplateLibrary.findById(entry._id);
    expect(stored.ratings).toHaveLength(0);
  });
});

describe("baseline guards", () => {
  it("rejects an unauthenticated caller", async () => {
    currentUser = null;

    await request(app).get("/api/template-library").expect(401);
  });

  it("rejects a caller with no organization", async () => {
    const { entry } = await seedPublished(ORG_A, bob);
    currentUser = {
      _id: new mongoose.Types.ObjectId(),
      organization: null,
      role: "member",
    };

    await request(app)
      .post(`/api/template-library/${entry._id}/clone`)
      .expect(403);
  });
});
