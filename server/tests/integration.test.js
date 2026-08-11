/**
 * Integration test suite — Critical API endpoint verification.
 *
 * Boots the Express app with MongoMemoryServer (via tests/setup.js) and
 * exercises the most important API flows end-to-end using supertest:
 *
 *   • Health check
 *   • Authentication (Clerk test token → is-auth / user-data)
 *   • Organizations (CRUD)
 *   • Meetings (list)
 *   • Policies (list)
 *
 * This file is executed as a dedicated CI job and can also be run locally:
 *   cd server
 *   node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit tests/integration.test.js
 */

import request from "supertest";
import { app } from "../server.js";
import User from "../models/userModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

// ─── Helpers ──────────────────────────────────────────────────────────────

const uniqueEmail = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;

/**
 * Creates a Mongo user with clerkUserId and returns a Clerk test Bearer token.
 */
async function createAuthenticatedUser(overrides = {}) {
  const email = overrides.email || uniqueEmail("integ");
  const name = overrides.name || "Test User";
  const user = await User.create({
    name,
    email,
    password: overrides.password || "password123",
    role: overrides.role || "member",
  });
  user.clerkUserId = overrides.clerkUserId || `user_test_${user._id}`;
  await user.save();

  const token = createClerkTestToken({
    clerkUserId: user.clerkUserId,
    email: user.email,
  });

  return { user, token, headers: authHeader(token) };
}

describe("Integration: Health Check", () => {
  it("GET /api/health returns 200 with status UP", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "UP");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("GET /health returns 200 with status UP", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UP");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION (Clerk)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Authentication", () => {
  it("GET /api/auth/is-auth returns 200 with a Clerk test token", async () => {
    const { headers } = await createAuthenticatedUser({
      email: uniqueEmail("auth-ok"),
    });
    const res = await request(app).get("/api/auth/is-auth").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/auth/user-data returns the authenticated user", async () => {
    const { user, headers } = await createAuthenticatedUser({
      email: uniqueEmail("auth-data"),
      name: "Clerk Data User",
    });
    const res = await request(app).get("/api/auth/user-data").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toMatchObject({
      email: user.email,
      name: "Clerk Data User",
    });
  });

  it("GET /api/auth/is-auth returns 401 for an unauthenticated request", async () => {
    const res = await request(app).get("/api/auth/is-auth");
    expect(res.status).toBe(401);
  });

  it("rejects tokens that lack a Clerk sub claim", async () => {
    const jwt = await import("jsonwebtoken");
    const badToken = jwt.default.sign(
      { id: "not-a-clerk-sub" },
      process.env.JWT_SECRET || "test_jwt_secret",
      { expiresIn: "1h" },
    );
    const res = await request(app)
      .get("/api/auth/is-auth")
      .set(authHeader(badToken));
    expect(res.status).toBe(401);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORGANIZATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Organizations", () => {
  it("creates an organization", async () => {
    const { headers } = await createAuthenticatedUser();

    const res = await request(app)
      .post("/api/organizations")
      .set(headers)
      .send({ name: `Integ Org ${Date.now()}` });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("organization");
    expect(res.body.organization).toHaveProperty("name");
  });

  it("lists organizations for the authenticated user", async () => {
    const { headers } = await createAuthenticatedUser();

    await request(app)
      .post("/api/organizations")
      .set(headers)
      .send({ name: `List Org ${Date.now()}` });

    const res = await request(app).get("/api/organizations/user").set(headers);
    expect(res.status).toBe(200);
  });

  it("returns 401 when listing organizations without auth", async () => {
    const res = await request(app).get("/api/organizations");
    expect(res.status).toBe(401);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEETINGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Meetings", () => {
  it("returns 401 when listing meetings without auth", async () => {
    const res = await request(app).get("/api/meetings/all");
    expect(res.status).toBe(401);
  });

  it("lists meetings for an organization (authenticated)", async () => {
    const { headers } = await createAuthenticatedUser();

    const orgRes = await request(app)
      .post("/api/organizations")
      .set(headers)
      .send({ name: `Meet Org ${Date.now()}` });

    const orgId = orgRes.body.organization._id;

    const res = await request(app)
      .get("/api/meetings/all")
      .set(headers)
      .set("x-organization-id", orgId);
    expect(res.status).toBe(200);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CALENDAR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Calendar", () => {
  it("returns 401 for unauthenticated calendar access", async () => {
    const res = await request(app).get("/api/calendar/events");
    expect(res.status).toBe(401);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KNOWLEDGE BASE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Knowledge Base", () => {
  it("returns 401 for unauthenticated knowledge access", async () => {
    const res = await request(app).get(
      "/api/knowledge/000000000000000000000001/graph",
    );
    expect(res.status).toBe(401);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POLICIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Policies", () => {
  it("returns 401 for unauthenticated policy access", async () => {
    const res = await request(app).get("/api/policies/");
    expect(res.status).toBe(401);
  });

  it("returns policies list for an authenticated user's organization", async () => {
    const { headers } = await createAuthenticatedUser();

    const orgRes = await request(app)
      .post("/api/organizations")
      .set(headers)
      .send({ name: `Policy Org ${Date.now()}` });

    const orgId = orgRes.body.organization._id;

    const res = await request(app)
      .get("/api/policies/")
      .set(headers)
      .set("x-organization-id", orgId);
    expect(res.status).toBe(200);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ASSISTANT / AI SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Assistant", () => {
  it("returns 401 for unauthenticated assistant query", async () => {
    const res = await request(app)
      .post("/api/assistant/query")
      .send({ query: "test" });
    expect([401, 403]).toContain(res.status);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Notifications", () => {
  it("returns 401 for unauthenticated notification access", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE LOADING VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Route Loading", () => {
  it("unknown route returns 404 (routes are loaded, not broken)", async () => {
    const res = await request(app).get("/api/nonexistent-route-12345");
    expect(res.status).toBe(404);
  });
});
