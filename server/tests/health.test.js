import request from "supertest";
import { app } from "../server.js";

describe("Health Check Endpoints", () => {
  it("should return 200 OK for GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "UP");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("env");
  });

  it("should return 200 OK for GET /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "UP");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("env");
  });
});
