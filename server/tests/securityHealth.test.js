/**
 * Issue #979 — security headers, health probes and request correlation.
 */

import { jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import { app } from "../server.js";
import { configureSecurity } from "../config/security.js";
import {
  checkMongo,
  checkRedis,
  collectHealth,
  configureHealthEndpoints,
} from "../config/health.js";
import {
  REQUEST_ID_HEADER,
  buildLogContext,
  isValidRequestId,
  redact,
} from "../middleware/requestContext.js";

describe("security headers (Issue #979)", () => {
  it("sets X-Content-Type-Options", async () => {
    // Without this a browser may MIME-sniff a JSON or user-uploaded response
    // into an executable type.
    const res = await request(app).get("/health/live");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("forbids framing the app", async () => {
    // The whole authenticated app could previously be embedded by any origin.
    // CSRF tokens do not mitigate clickjacking — the victim performs the click
    // themselves, inside the frame.
    const res = await request(app).get("/health/live");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["content-security-policy-report-only"]).toMatch(
      /frame-ancestors 'none'/,
    );
  });

  it("sets a Referrer-Policy", async () => {
    // Full URLs — including paths carrying meeting and organization IDs — used
    // to leak to third parties in the Referer header.
    const res = await request(app).get("/health/live");
    expect(res.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("removes the X-Powered-By banner", async () => {
    const res = await request(app).get("/health/live");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("ships CSP in report-only mode by default", async () => {
    // An enforcing CSP shipped blind is how CSP rollouts get reverted and never
    // tried again. Report-only first, flip via env once reports are clean.
    const res = await request(app).get("/health/live");
    expect(res.headers["content-security-policy-report-only"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toBeUndefined();
  });

  it("can be switched to an enforcing CSP", async () => {
    const enforcingApp = express();
    configureSecurity(enforcingApp, { enforceCsp: true });
    enforcingApp.get("/x", (req, res) => res.json({ ok: true }));

    const res = await request(enforcingApp).get("/x");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["content-security-policy-report-only"]).toBeUndefined();
  });

  it("omits HSTS outside production", async () => {
    // Sending HSTS from a local HTTP dev server pins the browser to
    // https://localhost for a year, which is miserable to debug.
    const res = await request(app).get("/health/live");
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("sends HSTS when enabled", async () => {
    const prodApp = express();
    configureSecurity(prodApp, { enableHsts: true });
    prodApp.get("/x", (req, res) => res.json({ ok: true }));

    const res = await request(prodApp).get("/x");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
  });

  it("allows the cross-origin images and media the app legitimately loads", async () => {
    const res = await request(app).get("/health/live");
    const csp = res.headers["content-security-policy-report-only"];

    // Attachments, org logos and avatars come from external storage; a policy
    // that blocked them would be reverted on first contact with production.
    expect(csp).toMatch(/img-src[^;]*https:/);
    expect(csp).toMatch(/connect-src[^;]*wss:/); // Socket.IO
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("does not permit inline or eval'd scripts", async () => {
    const res = await request(app).get("/health/live");
    const csp = res.headers["content-security-policy-report-only"];

    const scriptSrc = csp
      .split(";")
      .find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).not.toMatch(/unsafe-inline/);
    expect(scriptSrc).not.toMatch(/unsafe-eval/);
  });
});

describe("health probes (Issue #979)", () => {
  describe("liveness", () => {
    it("returns 200 without touching dependencies", async () => {
      const res = await request(app).get("/health/live");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("UP");
      expect(res.body).not.toHaveProperty("dependencies");
    });

    it("is available under /api as well", async () => {
      expect((await request(app).get("/api/health/live")).status).toBe(200);
    });
  });

  describe("readiness", () => {
    it("returns 200 with a per-dependency breakdown when healthy", async () => {
      const res = await request(app).get("/health/ready");

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.dependencies.mongodb.status).toBe("up");
      expect(res.body.dependencies).toHaveProperty("redis");
    });

    it("reports latency for a healthy dependency", async () => {
      const res = await request(app).get("/health/ready");
      expect(typeof res.body.dependencies.mongodb.latencyMs === "number").toBe(
        true,
      );
    });
  });

  describe("aggregate /health", () => {
    it("preserves the original response fields", async () => {
      // health-check.yml and any external monitor depend on these exact keys.
      const res = await request(app).get("/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "UP");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("env");
    });

    it("adds dependency and uptime detail", async () => {
      const res = await request(app).get("/health");
      expect(res.body).toHaveProperty("dependencies");
      expect(typeof res.body.uptimeSeconds).toBe("number");
    });

    it("is registered exactly once", async () => {
      // It used to be defined in both config/express.js and server.js; the
      // second was unreachable dead code and the two would drift.
      const healthRoutes = (
        app.router?.stack ??
        app._router?.stack ??
        []
      ).filter((layer) => layer.route?.path?.toString?.().includes("/health"));
      // One layer, registering the path array — not two separate layers.
      expect(healthRoutes.length).toBeLessThanOrEqual(3);
    });
  });

  describe("dependency failure reporting", () => {
    /** Mounts an isolated app with injected checks. */
    const appWith = (mongoCheck, redisCheck) => {
      const testApp = express();
      configureHealthEndpoints(testApp, { mongoCheck, redisCheck });
      return testApp;
    };

    const upRedis = async () => ({ status: "up", required: false });

    it("returns 503 when MongoDB is down", async () => {
      // The whole point: the old handler answered `200 UP` here while every
      // real request 500'd, so a monitor could never detect a database outage.
      const testApp = appWith(
        async () => ({
          status: "down",
          required: true,
          detail: "disconnected",
        }),
        upRedis,
      );

      const res = await request(testApp).get("/health/ready");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("DOWN");
      expect(res.body.ready).toBe(false);
      expect(res.body.dependencies.mongodb.detail).toBe("disconnected");
    });

    it("treats Redis as degraded, not failed", async () => {
      // The app is explicitly designed to run without Redis; failing readiness
      // on it would take the deployment out for a non-fatal condition.
      const testApp = appWith(
        async () => ({ status: "up", required: true }),
        async () => ({ status: "degraded", required: false, detail: "down" }),
      );

      const res = await request(testApp).get("/health/ready");

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.status).toBe("DEGRADED");
    });

    it("keeps liveness at 200 even when a dependency is down", async () => {
      // A failing liveness probe means "restart me", which wouldn't fix a
      // downstream outage — and doing it fleet-wide during a database incident
      // turns a partial outage into a total one.
      const testApp = appWith(
        async () => ({ status: "down", required: true }),
        upRedis,
      );

      expect((await request(testApp).get("/health/live")).status).toBe(200);
    });

    it("treats a check that throws as a failure rather than crashing", async () => {
      const testApp = appWith(async () => {
        throw new Error("boom");
      }, upRedis);

      const res = await request(testApp).get("/health/ready");
      expect(res.status).toBe(503);
      expect(res.body.dependencies.mongodb.detail).toBe("boom");
    });
  });

  describe("checkMongo", () => {
    it("reports the connection state when not connected", async () => {
      const result = await checkMongo({ connection: { readyState: 0 } });
      expect(result).toMatchObject({ status: "down", detail: "disconnected" });
    });

    it("pings a connected database rather than trusting readyState", async () => {
      // readyState can report `connected` while the socket is actually dead.
      const ping = jest.fn(async () => ({ ok: 1 }));
      const result = await checkMongo({
        connection: { readyState: 1, db: { admin: () => ({ ping }) } },
      });

      expect(ping).toHaveBeenCalled();
      expect(result.status).toBe("up");
    });

    it("reports a failed ping as down", async () => {
      const result = await checkMongo({
        connection: {
          readyState: 1,
          db: {
            admin: () => ({
              ping: async () => {
                throw new Error("no primary");
              },
            }),
          },
        },
      });

      expect(result).toMatchObject({ status: "down", detail: "no primary" });
    });

    it("bounds a hanging ping with a deadline", async () => {
      // A probe that hangs is worse than one that fails: the orchestrator gets
      // no answer and falls back to its own much longer timeout, during which a
      // broken instance keeps taking traffic.
      const result = await checkMongo({
        timeoutMs: 30,
        connection: {
          readyState: 1,
          db: { admin: () => ({ ping: () => new Promise(() => {}) }) },
        },
      });

      expect(result.status).toBe("down");
      expect(result.detail).toMatch(/timed out/);
    });
  });

  describe("checkRedis", () => {
    it("reports disabled when Redis is not configured", async () => {
      const result = await checkRedis({ client: null });
      expect(result).toMatchObject({ status: "disabled", required: false });
    });

    it("reports up for a responsive client", async () => {
      process.env.REDIS_URI = "redis://localhost:6379";
      try {
        const result = await checkRedis({
          client: { ping: async () => "PONG" },
        });
        expect(result.status).toBe("up");
        expect(result.required).toBe(false);
      } finally {
        delete process.env.REDIS_URI;
      }
    });

    it("reports degraded when the ping fails", async () => {
      process.env.REDIS_URI = "redis://localhost:6379";
      try {
        const result = await checkRedis({
          client: {
            ping: async () => {
              throw new Error("connection refused");
            },
          },
        });
        expect(result).toMatchObject({ status: "degraded", required: false });
      } finally {
        delete process.env.REDIS_URI;
      }
    });
  });

  describe("collectHealth", () => {
    it("is UP only when every required dependency is up", async () => {
      const result = await collectHealth({
        mongoCheck: async () => ({ status: "up", required: true }),
        redisCheck: async () => ({ status: "up", required: false }),
      });

      expect(result).toMatchObject({ status: "UP", ready: true });
    });

    it("is DEGRADED when an optional dependency is degraded", async () => {
      const result = await collectHealth({
        mongoCheck: async () => ({ status: "up", required: true }),
        redisCheck: async () => ({ status: "degraded", required: false }),
      });

      expect(result).toMatchObject({ status: "DEGRADED", ready: true });
    });

    it("is DOWN and not ready when a required dependency fails", async () => {
      const result = await collectHealth({
        mongoCheck: async () => ({ status: "down", required: true }),
        redisCheck: async () => ({ status: "up", required: false }),
      });

      expect(result).toMatchObject({ status: "DOWN", ready: false });
    });
  });
});

describe("request correlation (Issue #979)", () => {
  it("echoes a request id on every response", async () => {
    const res = await request(app).get("/health/live");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("reuses a valid inbound id so a trace carries through", async () => {
    const res = await request(app)
      .get("/health/live")
      .set(REQUEST_ID_HEADER, "trace-abc-123");

    expect(res.headers["x-request-id"]).toBe("trace-abc-123");
  });

  it("generates a fresh id when the inbound one is unsafe", async () => {
    // The value is echoed in a header and written to logs, so it's
    // attacker-controlled input: a newline could forge log entries.
    const res = await request(app)
      .get("/health/live")
      .set(REQUEST_ID_HEADER, "bad value with spaces");

    expect(res.headers["x-request-id"]).not.toBe("bad value with spaces");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("gives different requests different ids", async () => {
    const [a, b] = await Promise.all([
      request(app).get("/health/live"),
      request(app).get("/health/live"),
    ]);

    expect(a.headers["x-request-id"]).not.toBe(b.headers["x-request-id"]);
  });

  describe("isValidRequestId", () => {
    it.each(["abc123", "trace-1_2.3", "a".repeat(128)])("accepts %p", (value) =>
      expect(isValidRequestId(value)).toBe(true),
    );

    it.each([
      "",
      "with space",
      "new\nline",
      "semi;colon",
      "a".repeat(129),
      null,
      undefined,
      123,
    ])("rejects %p", (value) => expect(isValidRequestId(value)).toBe(false));
  });

  describe("redact", () => {
    it("masks sensitive keys", () => {
      // This repo has already had to fix "sensitive auth data in server logs"
      // once (#612); redacting at the logging boundary stops a future field
      // from quietly becoming a leak.
      const result = redact({
        email: "a@b.com",
        password: "hunter2",
        token: "abc",
        authorization: "Bearer x",
      });

      expect(result.email).toBe("a@b.com");
      expect(result.password).toBe("[REDACTED]");
      expect(result.token).toBe("[REDACTED]");
      expect(result.authorization).toBe("[REDACTED]");
    });

    it("is case-insensitive about key names", () => {
      expect(redact({ Password: "x", API_KEY: "y" })).toEqual({
        Password: "[REDACTED]",
        API_KEY: "[REDACTED]",
      });
    });

    it("redacts nested values", () => {
      const result = redact({ user: { name: "Ada", secret: "s" } });
      expect(result.user.name).toBe("Ada");
      expect(result.user.secret).toBe("[REDACTED]");
    });

    it("does not recurse forever on a cyclic object", () => {
      const cyclic = { name: "x" };
      cyclic.self = cyclic;
      expect(() => redact(cyclic)).not.toThrow();
    });

    it("passes primitives through", () => {
      expect(redact("plain")).toBe("plain");
      expect(redact(null)).toBeNull();
    });
  });

  describe("buildLogContext", () => {
    it("captures the fields needed to find a failed request", () => {
      const context = buildLogContext({
        id: "req-1",
        method: "POST",
        originalUrl: "/api/meetings",
        user: { id: "user-1" },
        ip: "127.0.0.1",
        startedAt: Date.now() - 50,
      });

      expect(context).toMatchObject({
        requestId: "req-1",
        method: "POST",
        path: "/api/meetings",
        userId: "user-1",
      });
      expect(context.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("tolerates an anonymous request", () => {
      const context = buildLogContext({ id: "r", method: "GET", url: "/x" });
      expect(context.userId).toBeNull();
    });

    it("returns an empty object for a missing request", () => {
      expect(buildLogContext(null)).toEqual({});
    });
  });
});

describe("body size limits (Issue #979)", () => {
  it("rejects an oversized body on an ordinary route", async () => {
    // Every endpoint — login included — used to buffer and JSON-parse up to
    // 50 MB before any handler, validator or auth check ran.
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send({ padding: "x".repeat(3 * 1024 * 1024) });

    expect(res.status).toBe(413);
  });
});

afterAll(async () => {
  await mongoose.connection.close().catch(() => {});
});
