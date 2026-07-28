import request from "supertest";
import { app } from "../server.js";

describe("Auth Endpoints", () => {
  const testUser = {
    name: "Test User",
    email: "testuser@example.com",
    password: "password123",
  };

  it("should register a new user", async () => {
    const agent = request.agent(app);

    // Fetch CSRF token first
    const csrfRes = await agent.get("/api/csrf-token");
    const token = csrfRes.body.csrfToken;

    const res = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", token)
      .send(testUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Registration successful");
  });

  it("should login the newly created user", async () => {
    const agent = request.agent(app);

    // Register first
    const regCsrf = await agent.get("/api/csrf-token");
    await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", regCsrf.body.csrfToken)
      .send(testUser);

    // Login
    const loginCsrf = await agent.get("/api/csrf-token");
    const res = await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", loginCsrf.body.csrfToken)
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Login successful");

    // Check if the JWT token cookie is set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const tokenCookie = cookies.find((cookie) => cookie.startsWith("token="));
    expect(tokenCookie).toBeDefined();
  });

  describe("Google Calendar OAuth", () => {
    beforeAll(() => {
      process.env.GOOGLE_CLIENT_ID = "mock-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";
      process.env.GOOGLE_REDIRECT_URI =
        "http://localhost:4000/api/auth/google-calendar/callback";
    });

    it("should reject unauthorized request to google-calendar", async () => {
      const res = await request(app).get("/api/auth/google-calendar");
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body.message).toMatch(/No token found|Please login first/i);
    });

    it("should redirect for authorized request to google-calendar", async () => {
      const agent = request.agent(app);

      // Register first
      const regCsrf = await agent.get("/api/csrf-token");
      await agent
        .post("/api/auth/register")
        .set("X-CSRF-Token", regCsrf.body.csrfToken)
        .send(testUser);

      // Login to set cookie
      const loginCsrf = await agent.get("/api/csrf-token");
      await agent
        .post("/api/auth/login")
        .set("X-CSRF-Token", loginCsrf.body.csrfToken)
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      // Make the authorized GET request to /api/auth/google-calendar
      const res = await agent.get("/api/auth/google-calendar");

      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toContain("accounts.google.com");
      expect(res.headers.location).toContain("client_id=mock-client-id");
    });
  });
});
