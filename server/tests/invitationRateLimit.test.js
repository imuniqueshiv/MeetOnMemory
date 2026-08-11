/**
 * Issue #1360 — organization-scoped invitation creation rate limiting.
 *
 * Exercises the limiter in isolation with express-rate-limit's MemoryStore so
 * Redis is not required. Production uses the same limiter with the shared
 * Redis store when available.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import express from "express";
import request from "supertest";
import { MemoryStore } from "express-rate-limit";
import {
  createInvitationCreateLimiter,
  resolveInvitationRateLimitOrgId,
} from "../middleware/rateLimiter.js";

const ORG_A = "64b0000000000000000000a1";
const ORG_B = "64b0000000000000000000b2";

const makeApp = (store) => {
  const app = express();
  app.use(express.json());
  app.post(
    "/api/invitations",
    createInvitationCreateLimiter({ store }),
    (_req, res) => {
      res.status(201).json({
        success: true,
        message: "Invitation created successfully.",
      });
    },
  );
  return app;
};

describe("resolveInvitationRateLimitOrgId", () => {
  it("reads organizationId from the request body", () => {
    expect(
      resolveInvitationRateLimitOrgId({ body: { organizationId: ORG_A } }),
    ).toBe(ORG_A);
  });

  it("falls back to params and user.organization", () => {
    expect(
      resolveInvitationRateLimitOrgId({
        body: {},
        params: { organizationId: ORG_B },
      }),
    ).toBe(ORG_B);
    expect(
      resolveInvitationRateLimitOrgId({
        body: {},
        params: {},
        user: { organization: ORG_A },
      }),
    ).toBe(ORG_A);
  });

  it("returns null when no organization id is present", () => {
    expect(resolveInvitationRateLimitOrgId({ body: {} })).toBeNull();
    expect(resolveInvitationRateLimitOrgId(null)).toBeNull();
  });
});

describe("invitationCreateLimiter (Issue #1360)", () => {
  let store;
  let app;

  beforeEach(() => {
    store = new MemoryStore();
    app = makeApp(store);
  });

  it("allows invitation creation under the limit", async () => {
    const res = await request(app)
      .post("/api/invitations")
      .send({ organizationId: ORG_A, email: "a@example.com" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("allows exactly 10 invitation creations per organization per hour", async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post("/api/invitations")
        .send({ organizationId: ORG_A, email: `user${i}@example.com` });
      expect(res.status).toBe(201);
    }
  });

  it("rejects the 11th invitation with HTTP 429 and a clear message", async () => {
    for (let i = 0; i < 10; i += 1) {
      await request(app)
        .post("/api/invitations")
        .send({ organizationId: ORG_A, email: `user${i}@example.com` });
    }

    const res = await request(app)
      .post("/api/invitations")
      .send({ organizationId: ORG_A, email: "overflow@example.com" });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/rate limit/i);
    expect(res.body.message).toMatch(/10 invitations per hour/i);
  });

  it("isolates limits between organizations", async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post("/api/invitations")
        .send({ organizationId: ORG_A, email: `a${i}@example.com` });
      expect(res.status).toBe(201);
    }

    const blocked = await request(app)
      .post("/api/invitations")
      .send({ organizationId: ORG_A, email: "a-block@example.com" });
    expect(blocked.status).toBe(429);

    const otherOrg = await request(app)
      .post("/api/invitations")
      .send({ organizationId: ORG_B, email: "b0@example.com" });
    expect(otherOrg.status).toBe(201);
    expect(otherOrg.body.success).toBe(true);
  });

  it("does not rate-limit requests missing organizationId", async () => {
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app)
        .post("/api/invitations")
        .send({ email: `nolimit${i}@example.com` });
      expect(res.status).toBe(201);
    }
  });
});
