import mongoose from "mongoose";
import { getRedisClient } from "../services/redisService.js";

// server/config/health.js
//
// Issue #979 — `/health` lied.
//
// The old handler was static:
//
//     app.get(["/health", "/api/health"], (req, res) => {
//       res.status(200).json({ status: "UP", timestamp: ..., env: ... });
//     });
//
// It returned `200 UP` regardless of whether anything it depends on was
// reachable. `config/mongodb.js` exits if the *initial* connect fails, but
// nothing watches for a later disconnect — so `readyState` could sit at 0
// indefinitely while `/health` kept answering UP and every real request 500'd.
// The repo runs `.github/workflows/health-check.yml` against this endpoint, so
// the monitoring that exists was structurally incapable of detecting a database
// outage.
//
// It also conflated **liveness** (is the process alive? must stay cheap and
// dependency-free, and a failure means "restart me") with **readiness** (should
// this instance receive traffic? must check dependencies, and a failure means
// "route around me"). With one shallow endpoint, a rolling deploy sends traffic
// to an instance whose dependencies aren't up, and a hung instance is never
// restarted because its liveness probe passes.

/** Mongoose connection states, by the numbers it actually reports. */
const MONGO_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
  99: "uninitialized",
};

const readIntEnv = (name, fallback) => {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Races a check against a deadline.
 *
 * Every dependency check is individually bounded, because a probe that hangs is
 * worse than a probe that fails: the orchestrator gets no answer at all and
 * falls back to its own (usually much longer) timeout, during which a broken
 * instance keeps receiving traffic.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {T} timeoutValue
 */
const withDeadline = (promise, timeoutMs, timeoutValue) => {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(timeoutValue), timeoutMs);
    timer.unref?.();
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Checks MongoDB.
 *
 * `readyState` alone isn't enough — it can report `connected` while the socket
 * is actually dead — so a real `ping` is issued against the admin command
 * interface.
 *
 * @param {object} [options]
 * @returns {Promise<{status: string, required: boolean, detail?: string, latencyMs?: number}>}
 */
export const checkMongo = async ({
  timeoutMs = readIntEnv("HEALTH_CHECK_TIMEOUT_MS", 2000),
  connection = mongoose.connection,
} = {}) => {
  const state = MONGO_STATES[connection?.readyState] ?? "unknown";

  if (connection?.readyState !== 1) {
    return { status: "down", required: true, detail: state };
  }

  const startedAt = Date.now();

  const ping = (async () => {
    try {
      await connection.db.admin().ping();
      return {
        status: "up",
        required: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return { status: "down", required: true, detail: error.message };
    }
  })();

  return withDeadline(ping, timeoutMs, {
    status: "down",
    required: true,
    detail: `ping timed out after ${timeoutMs}ms`,
  });
};

/**
 * Checks Redis.
 *
 * Reported as **degraded rather than down** when unavailable, and marked
 * `required: false`, because the app is explicitly designed to run without it:
 * `redisService` disables itself after 3 failed retries and the rate limiter,
 * cache and Socket.IO adapter all fall back. Failing readiness on Redis would
 * take the whole deployment out for a non-fatal condition.
 *
 * @param {object} [options]
 */
export const checkRedis = async ({
  timeoutMs = readIntEnv("HEALTH_CHECK_TIMEOUT_MS", 2000),
  client = undefined,
} = {}) => {
  const redis = client ?? getRedisClient();

  if (!process.env.REDIS_URI && !process.env.REDIS_URL) {
    return { status: "disabled", required: false, detail: "not configured" };
  }

  if (!redis) {
    return {
      status: "degraded",
      required: false,
      detail: "client unavailable",
    };
  }

  const startedAt = Date.now();

  const ping = (async () => {
    try {
      if (typeof redis.ping === "function") {
        await redis.ping();
      } else if (redis.isReady === false) {
        return { status: "degraded", required: false, detail: "not ready" };
      }
      return {
        status: "up",
        required: false,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return { status: "degraded", required: false, detail: error.message };
    }
  })();

  return withDeadline(ping, timeoutMs, {
    status: "degraded",
    required: false,
    detail: `ping timed out after ${timeoutMs}ms`,
  });
};

/**
 * Runs every dependency check and rolls them up.
 *
 * Overall status is driven only by dependencies marked `required` — a degraded
 * Redis lowers the reported status without failing the probe.
 *
 * @param {object} [options] injectable checks, for tests
 * @returns {Promise<{status: string, ready: boolean, dependencies: object}>}
 */
export const collectHealth = async ({
  mongoCheck = checkMongo,
  redisCheck = checkRedis,
} = {}) => {
  const [mongo, redis] = await Promise.all([
    mongoCheck().catch((error) => ({
      status: "down",
      required: true,
      detail: error?.message ?? "check threw",
    })),
    redisCheck().catch((error) => ({
      status: "degraded",
      required: false,
      detail: error?.message ?? "check threw",
    })),
  ]);

  const dependencies = { mongodb: mongo, redis };

  const requiredDown = Object.values(dependencies).some(
    (dep) => dep.required && dep.status !== "up",
  );
  const anyDegraded = Object.values(dependencies).some(
    (dep) => dep.status === "degraded",
  );

  let status = "UP";
  if (requiredDown) status = "DOWN";
  else if (anyDegraded) status = "DEGRADED";

  return { status, ready: !requiredDown, dependencies };
};

/**
 * Registers the health endpoints.
 *
 * Three, with distinct contracts:
 *
 *   GET /health/live  — liveness. No dependency checks, always 200 while the
 *                       process can serve a request. A failure here means
 *                       "restart me", so it must never fail for a *downstream*
 *                       outage — restarting wouldn't fix that, and doing it
 *                       across the fleet during a database incident turns a
 *                       partial outage into a total one.
 *   GET /health/ready — readiness. Checks dependencies; 503 means "route around
 *                       me".
 *   GET /health       — backwards-compatible aggregate. Keeps `status`,
 *                       `timestamp` and `env` exactly as before so
 *                       health-check.yml and any external monitor keep working,
 *                       and adds `dependencies`, `uptime` and `version`.
 *
 * @param {import("express").Express} app
 * @param {object} [options]
 */
export const configureHealthEndpoints = (app, options = {}) => {
  const startedAt = Date.now();

  app.get(["/health/live", "/api/health/live"], (req, res) => {
    res.status(200).json({
      status: "UP",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    });
  });

  app.get(["/health/ready", "/api/health/ready"], async (req, res) => {
    const health = await collectHealth(options);

    res.status(health.ready ? 200 : 503).json({
      status: health.status,
      ready: health.ready,
      timestamp: new Date().toISOString(),
      dependencies: health.dependencies,
    });
  });

  app.get(["/health", "/api/health"], async (req, res) => {
    const health = await collectHealth(options);

    res.status(health.ready ? 200 : 503).json({
      // Unchanged fields — external monitors depend on these.
      status: health.status,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      // New, additive.
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      dependencies: health.dependencies,
    });
  });
};

export default configureHealthEndpoints;
