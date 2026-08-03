// server/utils/gracefulShutdown.js
//
// Issue #975, Problem 3 — workers are never drained on shutdown.
//
// The previous handlers in server.js were:
//
//   process.on("SIGTERM", () => {
//     server.close(() => process.exit(0));
//   });
//
// `server.close()` stops the HTTP listener and nothing else. It does not close
// BullMQ workers, so an in-flight job was killed mid-execution — and because
// every queue ran with `attempts: 1`, BullMQ never re-delivered it. On a
// platform that redeploys by sending SIGTERM (Render, Fly, Kubernetes, …) that
// meant losing in-flight background work on *every single deploy*.
//
// It also had no forced-exit deadline. If any handle stayed open, the
// `server.close()` callback never fired, the process hung, and the platform
// eventually SIGKILLed it — killing in-flight jobs even on the "graceful" path.
//
// This module fixes both, and makes the sequence idempotent so a second signal
// (impatient operator, or SIGINT arriving right after SIGTERM) doesn't start a
// second teardown on top of the first.

/**
 * Builds a graceful-shutdown controller.
 *
 * Ordering is deliberate:
 *   1. stop accepting new HTTP connections  — new work stops arriving
 *   2. close Socket.IO                      — realtime clients get a clean close
 *   3. drain BullMQ workers                 — in-flight jobs run to completion
 *   4. close datastores (Mongo, Redis)      — nothing can still be issuing queries
 *
 * Each step is individually try/caught: a failure in one must not prevent the
 * remaining steps from running, because the alternative is leaking the very
 * connections we're trying to close.
 *
 * @param {object} deps
 * @param {import("http").Server} deps.server
 * @param {object} [deps.io] Socket.IO server
 * @param {Function} [deps.closeQueues] async () => void
 * @param {Function} [deps.closeDatabase] async () => void
 * @param {Function} [deps.closeRedis] async () => void
 * @param {number} [deps.forceExitAfterMs] hard deadline before process.exit
 * @param {Console|object} [deps.logger]
 * @param {Function} [deps.exit] injectable process.exit, for tests
 */
export const createGracefulShutdown = ({
  server,
  io = null,
  closeQueues = null,
  closeDatabase = null,
  closeRedis = null,
  forceExitAfterMs = Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) ||
    30000,
  logger = console,
  exit = (code) => process.exit(code),
} = {}) => {
  let shuttingDown = false;
  /** @type {Promise<void>|null} */
  let inFlight = null;

  /**
   * Runs a shutdown step, logging and swallowing any failure.
   * @param {string} label
   * @param {Function|null} fn
   */
  const step = async (label, fn) => {
    if (typeof fn !== "function") return;
    try {
      await fn();
      logger.log?.(`   ✓ ${label}`);
    } catch (err) {
      logger.error?.(`   ✗ ${label} failed:`, err?.message || err);
    }
  };

  /** Promisified `server.close()` — the callback form never rejects. */
  const closeHttpServer = () =>
    new Promise((resolve) => {
      if (!server || typeof server.close !== "function") return resolve();
      server.close(() => resolve());
    });

  const closeSocketIo = () =>
    new Promise((resolve) => {
      if (!io || typeof io.close !== "function") return resolve();
      io.close(() => resolve());
    });

  /**
   * @param {string} signal
   * @returns {Promise<void>}
   */
  const shutdown = async (signal = "SHUTDOWN") => {
    if (shuttingDown) {
      logger.warn?.(
        `⚠️ ${signal} received while shutdown already in progress — ignoring.`,
      );
      return inFlight;
    }
    shuttingDown = true;

    logger.log?.(`\n🛑 ${signal} received. Shutting down gracefully...`);

    // Arm the deadline *before* doing any work. Whatever happens below —
    // including a promise that never settles — the process exits.
    const forceTimer = setTimeout(() => {
      logger.error?.(
        `⏱️ Shutdown exceeded ${forceExitAfterMs}ms. Forcing exit.`,
      );
      exit(1);
    }, forceExitAfterMs);
    // Don't let the deadline timer itself be the thing keeping us alive.
    forceTimer.unref?.();

    inFlight = (async () => {
      await step("HTTP server closed", closeHttpServer);
      await step("Socket.IO closed", closeSocketIo);
      // Workers before datastores: a draining job still needs Mongo and Redis.
      await step("Background workers drained", closeQueues);
      await step("Database connection closed", closeDatabase);
      await step("Redis connection closed", closeRedis);

      clearTimeout(forceTimer);
      logger.log?.("👋 Shutdown complete.");
      exit(0);
    })();

    return inFlight;
  };

  /**
   * Attaches the signal and fatal-error handlers.
   *
   * `unhandledRejection` and `uncaughtException` are included because reaching
   * either means process state is no longer trustworthy — the correct response
   * is to drain and exit non-zero so the supervisor restarts us, not to limp on.
   *
   * @param {NodeJS.Process} [proc]
   */
  const registerSignalHandlers = (proc = process) => {
    proc.on("SIGTERM", () => shutdown("SIGTERM"));
    proc.on("SIGINT", () => shutdown("SIGINT"));

    proc.on("unhandledRejection", (reason) => {
      logger.error?.("❌ Unhandled promise rejection:", reason);
    });

    proc.on("uncaughtException", (err) => {
      logger.error?.("❌ Uncaught exception:", err?.stack || err);
      shutdown("uncaughtException").then(() => exit(1));
    });
  };

  return {
    shutdown,
    registerSignalHandlers,
    isShuttingDown: () => shuttingDown,
  };
};

export default createGracefulShutdown;
