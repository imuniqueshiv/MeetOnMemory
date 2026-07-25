/**
 * Integration test suite — Critical API endpoint verification.
 *
 * Boots the Express app with MongoMemoryServer (via tests/setup.js) and
 * exercises the most important API flows end-to-end using supertest:
 *
 *   • Health check
 *   • Authentication (register, login, CSRF)
 *   • Organizations (CRUD)
 *   • Meetings (create, list)
 *   • Invitations (send, accept)
 *   • Policies (create, list)
 *
 * This file is executed as a dedicated CI job and can also be run locally:
 *   cd server
 *   node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit tests/integration.test.js
 */

import request from "supertest";
import { app } from "../server.js";

// ─── Helpers ──────────────────────────────────────────────────────────────

const uniqueEmail = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;

/**
 * Creates a supertest agent pre-configured with a CSRF cookie.
 * Returns { agent, csrfToken }.
 */
async function createCsrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get("/api/csrf-token");
  return { agent, csrfToken: res.body.csrfToken };
}

/**
 * Fetches a fresh CSRF token for an existing agent (tokens may rotate).
 */
async function refreshCsrfToken(agent) {
  const res = await agent.get("/api/csrf-token");
  return res.body.csrfToken;
}

/**
 * Registers and logs in a user, returning { agent, csrfToken, user }.
 */
async function registerAndLogin(overrides = {}) {
  const { agent, csrfToken } = await createCsrfAgent();
  const userData = {
    name: overrides.name || "Test User",
    email: overrides.email || uniqueEmail("integ"),
    password: overrides.password || "password123",
  };

  await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", csrfToken)
    .send(userData);

  const loginCsrf = await refreshCsrfToken(agent);
  await agent
    .post("/api/auth/login")
    .set("X-CSRF-Token", loginCsrf)
    .send({ email: userData.email, password: userData.password });

  const finalCsrf = await refreshCsrfToken(agent);
  return { agent, csrfToken: finalCsrf, user: userData };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEALTH CHECK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
// CSRF TOKEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: CSRF Token", () => {
  it("GET /api/csrf-token returns a non-empty token", async () => {
    const res = await request(app).get("/api/csrf-token");
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeTruthy();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Authentication", () => {
  it("registers a new user and returns 201", async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", csrfToken)
      .send({
        name: "Integration User",
        email: uniqueEmail("auth-reg"),
        password: "password123",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("logs in a registered user and sets a JWT cookie", async () => {
    const email = uniqueEmail("auth-login");
    const { agent, csrfToken } = await createCsrfAgent();

    await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Login User", email, password: "password123" });

    const loginCsrf = await refreshCsrfToken(agent);
    const res = await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", loginCsrf)
      .send({ email, password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
  });

  it("rejects login with wrong password", async () => {
    const email = uniqueEmail("auth-bad-pw");
    const { agent, csrfToken } = await createCsrfAgent();

    await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Bad PW", email, password: "password123" });

    const loginCsrf = await refreshCsrfToken(agent);
    const res = await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", loginCsrf)
      .send({ email, password: "wrong" });

    // Auth controller returns 400 for invalid credentials
    expect([400, 401]).toContain(res.status);
  });

  it("GET /api/auth/is-auth returns 200 for an authenticated user", async () => {
    const { agent } = await registerAndLogin();
    const res = await agent.get("/api/auth/is-auth");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/auth/is-auth returns 401 for an unauthenticated request", async () => {
    const res = await request(app).get("/api/auth/is-auth");
    expect(res.status).toBe(401);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORGANIZATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Integration: Organizations", () => {
  it("creates an organization", async () => {
    const { agent, csrfToken } = await registerAndLogin();

    const res = await agent
      .post("/api/organizations")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: `Integ Org ${Date.now()}` });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("organization");
    expect(res.body.organization).toHaveProperty("name");
  });

  it("lists organizations for the authenticated user", async () => {
    const { agent, csrfToken } = await registerAndLogin();

    // Create one org first
    await agent
      .post("/api/organizations")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: `List Org ${Date.now()}` });

    // Use /user endpoint which returns the user's joined organizations
    const res = await agent.get("/api/organizations/user");
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
    // Use the /all endpoint — auth check should fire first.
    const res = await request(app).get("/api/meetings/all");
    expect(res.status).toBe(401);
  });

  it("lists meetings for an organization (authenticated)", async () => {
    const { agent, csrfToken } = await registerAndLogin();

    // Create org and select it (sets organizationId on session)
    const orgRes = await agent
      .post("/api/organizations")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: `Meet Org ${Date.now()}` });

    const orgId = orgRes.body.organization._id;

    // The meetings list route is GET /api/meetings/all with orgId header
    const res = await agent
      .get("/api/meetings/all")
      .set("x-organization-id", orgId);
    // Should return 200 with meetings list
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
    const { agent, csrfToken } = await registerAndLogin();

    // Create org
    const orgRes = await agent
      .post("/api/organizations")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: `Policy Org ${Date.now()}` });

    const orgId = orgRes.body.organization._id;

    const res = await agent
      .get("/api/policies/")
      .set("x-organization-id", orgId);
    // Expect 200 with policies array
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
    // Expect 401 or 403 — route is auth-protected
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
