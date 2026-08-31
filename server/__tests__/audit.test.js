import request from "supertest";
import express from "express";
import { describe, it, expect } from "vitest";
import auditRouter from "../routes/auditRoutes.js";

const app = express();
app.use(express.json());
app.use("/api", auditRouter);

describe("Server-Side Compliance Audit Logging Pipeline (#2642)", () => {
  it("should accept valid requests and return a 201 status code", async () => {
    const res = await request(app)
      .post("/api/organizations/org-123/audit")
      .send({
        action: "ORG_DELETION",
        userId: "user-789",
        details: "Unit test execution log payload structure",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain("audit trail captured successfully");
  });

  it("should return a 400 status code if mandatory properties are missing", async () => {
    const res = await request(app)
      .post("/api/organizations/org-123/audit")
      .send({
        details: "Incomplete parameters test structure",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing mandatory");
  });
});
