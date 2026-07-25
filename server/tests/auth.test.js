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
});
