/**
 * Regression tests for Issue #1272 — the report template API had no
 * authentication, and no handler could resolve its own organization.
 *
 * These mount the real `routes/reportRoutes.js` on a bare app rather than
 * calling the handlers directly. That distinction is the whole point: the
 * missing `userAuth` was a property of the *route file*, so a test that invoked
 * `getReportTemplates(req, res)` with a hand-built `req.user` would have passed
 * against the vulnerable code.
 *
 * Confirmed load-bearing: against `main` every test in this file fails except
 * the two 400 cases — anonymous access returns 500 instead of 401, and every
 * authenticated request returns 400 or 404 because `req.user.currentOrganization`
 * is `undefined` and the organization comparisons compare a string to an
 * ObjectId.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

// ── Session injection ──────────────────────────────────────────────────────
// `userAuth` verifies a Clerk session, which is not what is under test. It is
// replaced with a switch that injects whichever `req.user` the current test
// wants — including `null`, to stand in for an unauthenticated caller — so the
// suite exercises the authorization chain in isolation.
//
// The mock must be registered before the router is loaded, so the router and
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

const { default: reportRoutes } = await import("../routes/reportRoutes.js");
const { default: ReportTemplate } =
  await import("../models/reportTemplateModel.js");
const { default: Meeting } = await import("../models/meetingModel.js");

// `createdBy` is `ref: "User"`. server.js registers every model at boot; this
// suite mounts one router, so it registers the referenced schemas explicitly.
await import("../models/userModel.js");
await import("../models/organizationModel.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

/** Author of the seeded templates. */
const alice = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};

/** Colleague of alice — same organization, different person. */
const bob = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "admin",
};

/** Deliberately privileged, but in a *different* organization. */
const mallory = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
  role: "owner",
};

/** Authenticated, but not a member of any organization. */
const orphan = {
  _id: new mongoose.Types.ObjectId(),
  organization: null,
  role: "member",
};

/** `PERMISSIONS.reports` excludes viewer and guest. */
const viewer = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "viewer",
};

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }

  app = express();
  app.use(express.json());
  app.use("/api/reports", reportRoutes);
});

beforeEach(() => {
  currentUser = alice;
});

const validTemplateBody = (overrides = {}) => ({
  name: "Weekly Ops Review",
  description: "Action items and decisions from the last week",
  sections: [{ type: "ACTION_ITEMS", title: "Actions", order: 0 }],
  defaultFilters: { dateRangeDays: 7, tags: [], meetingTypes: [] },
  isShared: false,
  ...overrides,
});

/** A private template authored by alice in org A. */
const seedPrivateTemplate = (overrides = {}) =>
  ReportTemplate.create({
    name: "Alice private",
    organization: ORG_A,
    createdBy: alice._id,
    isShared: false,
    sections: [{ type: "DECISION_LOG", title: "Decisions", order: 0 }],
    defaultFilters: { dateRangeDays: 30, tags: [], meetingTypes: [] },
    ...overrides,
  });

/** A template published to the whole of org B. */
const seedForeignSharedTemplate = () =>
  ReportTemplate.create({
    name: "Org B shared",
    organization: ORG_B,
    createdBy: mallory._id,
    isShared: true,
    sections: [{ type: "ACTION_ITEMS", title: "Actions", order: 0 }],
    defaultFilters: { dateRangeDays: 30, tags: [], meetingTypes: [] },
  });

// ───────────────────────────────────────────────────────────────────────────
describe("authentication", () => {
  it.each([
    ["get", "/api/reports/templates"],
    ["post", "/api/reports/templates"],
    ["get", `/api/reports/templates/${new mongoose.Types.ObjectId()}`],
    ["put", `/api/reports/templates/${new mongoose.Types.ObjectId()}`],
    ["delete", `/api/reports/templates/${new mongoose.Types.ObjectId()}`],
    ["post", `/api/reports/generate/${new mongoose.Types.ObjectId()}`],
  ])("rejects an unauthenticated %s %s with 401", async (method, path) => {
    currentUser = null;

    // Against `main`: 500, because the handler dereferenced `req.user`.
    await request(app)[method](path).send({}).expect(401);
  });

  it("does not create a template for an unauthenticated caller", async () => {
    currentUser = null;

    await request(app)
      .post("/api/reports/templates")
      .send(validTemplateBody())
      .expect(401);

    expect(await ReportTemplate.countDocuments()).toBe(0);
  });
});

describe("organization membership", () => {
  it("rejects a user with no organization with 403", async () => {
    currentUser = orphan;

    const res = await request(app).get("/api/reports/templates").expect(403);

    expect(res.body.message).toMatch(/organization membership required/i);
  });
});

describe("role permissions", () => {
  it("refuses a viewer, who has no reports:view permission", async () => {
    currentUser = viewer;

    await request(app).get("/api/reports/templates").expect(403);
  });

  it("allows a member, who does", async () => {
    await request(app).get("/api/reports/templates").expect(200);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("GET /templates", () => {
  it("returns the caller's own templates", async () => {
    await seedPrivateTemplate();

    // Against `main`: 400 "Organization context required".
    const res = await request(app).get("/api/reports/templates").expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Alice private");
  });

  it("returns a colleague's shared template but not their private one", async () => {
    await seedPrivateTemplate({ name: "Alice private" });
    await seedPrivateTemplate({ name: "Alice shared", isShared: true });
    currentUser = bob;

    const res = await request(app).get("/api/reports/templates").expect(200);

    expect(res.body.data.map((t) => t.name)).toEqual(["Alice shared"]);
  });

  it("never returns another organization's templates", async () => {
    await seedForeignSharedTemplate();

    const res = await request(app).get("/api/reports/templates").expect(200);

    expect(res.body.data).toEqual([]);
  });
});

describe("POST /templates", () => {
  it("creates a template scoped to the caller's organization", async () => {
    const res = await request(app)
      .post("/api/reports/templates")
      .send(validTemplateBody())
      .expect(201);

    expect(res.body.data.name).toBe("Weekly Ops Review");

    const stored = await ReportTemplate.findById(res.body.data._id);
    expect(stored.organization.toString()).toBe(ORG_A.toString());
    expect(stored.createdBy.toString()).toBe(alice._id.toString());
  });

  it("ignores organization and createdBy supplied in the body", async () => {
    const res = await request(app)
      .post("/api/reports/templates")
      .send(
        validTemplateBody({
          organization: ORG_B.toString(),
          createdBy: mallory._id.toString(),
        }),
      )
      .expect(201);

    const stored = await ReportTemplate.findById(res.body.data._id);
    expect(stored.organization.toString()).toBe(ORG_A.toString());
    expect(stored.createdBy.toString()).toBe(alice._id.toString());
  });

  it("rejects an invalid payload with 400", async () => {
    const res = await request(app)
      .post("/api/reports/templates")
      .send({ name: "" })
      .expect(400);

    expect(res.body.message).toBe("Validation error");
  });
});

describe("GET /templates/:id", () => {
  it("serves a template to its author", async () => {
    const template = await seedPrivateTemplate();

    // Against `main`: 404 — `template.organization.toString() !== orgId`
    // compared a string to an ObjectId and was always true.
    const res = await request(app)
      .get(`/api/reports/templates/${template._id}`)
      .expect(200);

    expect(res.body.data.name).toBe("Alice private");
  });

  it("refuses a colleague a private template with 403", async () => {
    const template = await seedPrivateTemplate();
    currentUser = bob;

    await request(app)
      .get(`/api/reports/templates/${template._id}`)
      .expect(403);
  });

  it("hides another organization's shared template behind a 404", async () => {
    const template = await seedForeignSharedTemplate();

    const res = await request(app)
      .get(`/api/reports/templates/${template._id}`)
      .expect(404);

    // 404 rather than 403: a cross-tenant caller must not learn the id is real.
    expect(res.body.message).toBe("Template not found");
  });

  it("rejects a malformed id with 400 rather than 500", async () => {
    const res = await request(app)
      .get("/api/reports/templates/not-an-object-id")
      .expect(400);

    expect(res.body.message).toBe("Invalid template ID");
  });
});

describe("PUT /templates/:id", () => {
  it("lets the author edit their template", async () => {
    const template = await seedPrivateTemplate();

    const res = await request(app)
      .put(`/api/reports/templates/${template._id}`)
      .send(validTemplateBody({ name: "Renamed" }))
      .expect(200);

    expect(res.body.data.name).toBe("Renamed");
  });

  it("refuses a colleague, even one shared with", async () => {
    const template = await seedPrivateTemplate({ isShared: true });
    currentUser = bob;

    await request(app)
      .put(`/api/reports/templates/${template._id}`)
      .send(validTemplateBody({ name: "Hijacked" }))
      .expect(403);

    const stored = await ReportTemplate.findById(template._id);
    expect(stored.name).toBe("Alice private");
  });

  it("refuses a cross-organization caller and leaves the template intact", async () => {
    const template = await seedForeignSharedTemplate();

    await request(app)
      .put(`/api/reports/templates/${template._id}`)
      .send(validTemplateBody({ name: "Hijacked" }))
      .expect(404);

    const stored = await ReportTemplate.findById(template._id);
    expect(stored.name).toBe("Org B shared");
    expect(stored.organization.toString()).toBe(ORG_B.toString());
  });

  it("cannot be used to move a template into another organization", async () => {
    const template = await seedPrivateTemplate();

    await request(app)
      .put(`/api/reports/templates/${template._id}`)
      .send(
        validTemplateBody({
          organization: ORG_B.toString(),
          generationCount: 9999,
        }),
      )
      .expect(200);

    const stored = await ReportTemplate.findById(template._id);
    expect(stored.organization.toString()).toBe(ORG_A.toString());
    expect(stored.generationCount).toBe(0);
  });
});

describe("DELETE /templates/:id", () => {
  it("lets the author delete their template", async () => {
    const template = await seedPrivateTemplate();

    await request(app)
      .delete(`/api/reports/templates/${template._id}`)
      .expect(200);

    expect(await ReportTemplate.findById(template._id)).toBeNull();
  });

  it("refuses a cross-organization caller and leaves the template in place", async () => {
    const template = await seedForeignSharedTemplate();

    await request(app)
      .delete(`/api/reports/templates/${template._id}`)
      .expect(404);

    expect(await ReportTemplate.findById(template._id)).not.toBeNull();
  });
});

describe("POST /generate/:id", () => {
  it("generates a report scoped to the caller's organization", async () => {
    const template = await seedPrivateTemplate({
      sections: [{ type: "ATTENDANCE_HEATMAP", title: "Attendance", order: 0 }],
    });

    await Meeting.create({
      uploadedBy: alice._id,
      organization: ORG_A,
      title: "Org A standup",
      date: new Date(),
      participants: [{ name: "Alice" }, { name: "Bob" }],
    });
    await Meeting.create({
      uploadedBy: mallory._id,
      organization: ORG_B,
      title: "Org B standup",
      date: new Date(),
      participants: [{ name: "Mallory" }],
    });

    // Against `main`: 404 "Report Template not found in your organization.",
    // because `orgId` reached the service as an ObjectId.
    const res = await request(app)
      .post(`/api/reports/generate/${template._id}`)
      .send({})
      .expect(200);

    expect(res.body.data.meetingCount).toBe(1);

    const attendance = res.body.data.sections[0].data;
    expect(attendance.map((a) => a.name).sort()).toEqual(["Alice", "Bob"]);
    expect(attendance.map((a) => a.name)).not.toContain("Mallory");
  });

  it("refuses to generate from another organization's template", async () => {
    const template = await seedForeignSharedTemplate();

    const res = await request(app)
      .post(`/api/reports/generate/${template._id}`)
      .send({})
      .expect(404);

    // The message must not say "in your organization" — that wording confirms
    // the id names a real template, which is the distinction the 404 exists to
    // hide.
    expect(res.body.message).toBe("Report Template not found");

    const stored = await ReportTemplate.findById(template._id);
    expect(stored.generationCount).toBe(0);
  });

  it("is indistinguishable from generating with an id that does not exist", async () => {
    const foreign = await seedForeignSharedTemplate();

    const existsElsewhere = await request(app)
      .post(`/api/reports/generate/${foreign._id}`)
      .send({})
      .expect(404);

    const doesNotExist = await request(app)
      .post(`/api/reports/generate/${new mongoose.Types.ObjectId()}`)
      .send({})
      .expect(404);

    expect(existsElsewhere.body).toEqual(doesNotExist.body);
  });

  it("refuses to generate from a colleague's private template", async () => {
    const template = await seedPrivateTemplate();
    currentUser = bob;

    await request(app)
      .post(`/api/reports/generate/${template._id}`)
      .send({})
      .expect(403);
  });

  it("rejects a malformed id with 400", async () => {
    await request(app)
      .post("/api/reports/generate/not-an-object-id")
      .send({})
      .expect(400);
  });
});
