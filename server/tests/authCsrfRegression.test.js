import request from "supertest";
import { app } from "../server.js";

const uniqueEmail = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

/**
 * Helper: obtain a CSRF token + cookie from the server.
 * Returns { token, agent } where the agent already carries the _csrf cookie.
 */
async function getCsrf(agent) {
  const res = await agent.get("/api/csrf-token");
  expect(res.statusCode).toBe(200);
  expect(res.body.csrfToken).toBeTruthy();
  return res.body.csrfToken;
}

describe("Auth & CSRF regression", () => {
  it("registers, keeps the session cookie, and clears it on logout", async () => {
    const agent = request.agent(app);
    const token = await getCsrf(agent);
    const user = {
      name: "Session User",
      email: uniqueEmail("session"),
      password: "password123",
    };

    const registerRes = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", token)
      .send(user);
    expect(registerRes.statusCode).toBe(201);
    expect(registerRes.body.success).toBe(true);

    const cookies = registerRes.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies.some((cookie) => cookie.startsWith("token="))).toBe(true);
    expect(cookies.some((cookie) => /HttpOnly/i.test(cookie))).toBe(true);

    const authRes = await agent.get("/api/auth/is-auth");
    expect(authRes.statusCode).toBe(200);
    expect(authRes.body.success).toBe(true);

    const userRes = await agent.get("/api/auth/user-data");
    expect(userRes.statusCode).toBe(200);
    expect(userRes.body.success).toBe(true);
    expect(userRes.body.user.email).toBe(user.email);

    // Fetch a fresh CSRF token for logout (csurf may rotate secrets)
    const logoutToken = await getCsrf(agent);
    const logoutRes = await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", logoutToken)
      .send({});
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    const afterLogout = await agent.get("/api/auth/is-auth");
    expect(afterLogout.statusCode).toBe(401);
    expect(afterLogout.body.success).toBe(false);
  });

  it("logs in an existing user and restores auth state", async () => {
    const agent = request.agent(app);
    const user = {
      name: "Login User",
      email: uniqueEmail("login"),
      password: "password123",
    };

    // Register
    const regToken = await getCsrf(agent);
    await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", regToken)
      .send(user);

    // Logout
    const logoutToken = await getCsrf(agent);
    await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", logoutToken)
      .send({});

    // Login
    const loginToken = await getCsrf(agent);
    const loginRes = await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", loginToken)
      .send({
        email: user.email,
        password: user.password,
      });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.success).toBe(true);

    const authRes = await agent.get("/api/auth/is-auth");
    expect(authRes.body.success).toBe(true);
  });

  describe("CSRF enforcement on protected mutations", () => {
    it("rejects protected mutations without a CSRF token", async () => {
      const agent = request.agent(app);
      const token = await getCsrf(agent);
      const user = {
        name: "Csrf Missing",
        email: uniqueEmail("csrf-missing"),
        password: "password123",
      };

      await agent
        .post("/api/auth/register")
        .set("X-CSRF-Token", token)
        .send(user);

      // Attempt a protected mutation WITHOUT the CSRF token
      const res = await agent.post("/api/organizations").send({
        name: `Org ${Date.now()}`,
      });

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: "CSRF_INVALID",
      });
    });

    it("rejects auth mutations without a CSRF token", async () => {
      const agent = request.agent(app);

      // Attempt register WITHOUT fetching a CSRF token first
      const res = await agent.post("/api/auth/register").send({
        name: "No Csrf",
        email: uniqueEmail("no-csrf"),
        password: "password123",
      });

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: "CSRF_INVALID",
      });
    });

    it("accepts a protected mutation after fetching a fresh CSRF token", async () => {
      const agent = request.agent(app);
      const token = await getCsrf(agent);
      const user = {
        name: "Csrf Valid",
        email: uniqueEmail("csrf-valid"),
        password: "password123",
      };

      await agent
        .post("/api/auth/register")
        .set("X-CSRF-Token", token)
        .send(user);

      const csrfRes = await agent.get("/api/csrf-token");
      expect(csrfRes.statusCode).toBe(200);
      expect(csrfRes.body.csrfToken).toBeTruthy();

      const res = await agent
        .post("/api/organizations")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send({ name: `Org ${Date.now()}` });

      expect(res.body.code).not.toBe("CSRF_INVALID");
      expect(res.statusCode).not.toBe(403);
      expect(res.body.success).toBe(true);
    });

    it("accepts organization join mutation with valid CSRF token", async () => {
      const agent = request.agent(app);
      const token = await getCsrf(agent);
      const user = {
        name: "Csrf Join",
        email: uniqueEmail("csrf-join"),
        password: "password123",
      };

      await agent
        .post("/api/auth/register")
        .set("X-CSRF-Token", token)
        .send(user);

      const csrfRes = await agent.get("/api/csrf-token");

      const res = await agent
        .post("/api/organizations/join")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send({ inviteCode: "dummy-code" });

      expect(res.body.code).not.toBe("CSRF_INVALID");
      // The join will fail due to invalid invite code, but NOT due to CSRF
      expect(res.statusCode).not.toBe(403);
    });

    it.skip("emits CSRF cookie with sameSite=strict in development and sameSite=none; secure in production", async () => {
      // 1. Test development environment behavior
      process.env.NODE_ENV = "development";
      const devAgent = request.agent(app);
      const devCsrfRes = await devAgent.get("/api/csrf-token");
      const devCookies = devCsrfRes.headers["set-cookie"] || [];
      const devCsrfCookie = devCookies.find((c) => c.startsWith("_csrf="));

      expect(devCsrfCookie).toBeDefined();
      expect(devCsrfCookie).toMatch(/SameSite=Strict/i);
      expect(devCsrfCookie).not.toMatch(/Secure/i);

      // 2. Test production environment behavior
      process.env.NODE_ENV = "production";
      const prodAgent = request.agent(app);
      const prodCsrfRes = await prodAgent.get("/api/csrf-token");
      const prodCookies = prodCsrfRes.headers["set-cookie"] || [];
      const prodCsrfCookie = prodCookies.find((c) => c.startsWith("_csrf="));

      expect(prodCsrfCookie).toBeDefined();
      expect(prodCsrfCookie).toMatch(/SameSite=None/i);
      expect(prodCsrfCookie).toMatch(/Secure/i);
    });
  });
});
