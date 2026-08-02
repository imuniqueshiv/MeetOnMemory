/**
 * Issue #975 — graceful shutdown.
 *
 * The behaviour under test is the ordering and the deadline, both of which are
 * pure control flow over injected dependencies. Nothing here touches a real
 * HTTP server, Redis, or Mongo.
 */

import { jest } from "@jest/globals";
import { createGracefulShutdown } from "../utils/gracefulShutdown.js";

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

/** A stub http.Server whose close() invokes its callback. */
const makeServer = (order) => ({
  close: jest.fn((cb) => {
    order.push("http");
    cb();
  }),
});

/** A stub socket.io server whose close() invokes its callback. */
const makeIo = (order) => ({
  close: jest.fn((cb) => {
    order.push("io");
    cb();
  }),
});

describe("createGracefulShutdown (Issue #975)", () => {
  it("closes HTTP, then Socket.IO, then workers, then datastores", async () => {
    const order = [];
    const exit = jest.fn();

    const shutdownController = createGracefulShutdown({
      server: makeServer(order),
      io: makeIo(order),
      closeQueues: jest.fn(async () => order.push("queues")),
      closeDatabase: jest.fn(async () => order.push("db")),
      closeRedis: jest.fn(async () => order.push("redis")),
      logger: silentLogger,
      exit,
    });

    await shutdownController.shutdown("SIGTERM");

    // Workers must drain before Mongo/Redis close, because a draining job is
    // still issuing queries against both.
    expect(order).toEqual(["http", "io", "queues", "db", "redis"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("drains workers even when there is no Socket.IO server", async () => {
    const order = [];
    const exit = jest.fn();

    const shutdownController = createGracefulShutdown({
      server: makeServer(order),
      io: null,
      closeQueues: jest.fn(async () => order.push("queues")),
      logger: silentLogger,
      exit,
    });

    await shutdownController.shutdown("SIGINT");

    expect(order).toEqual(["http", "queues"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("is idempotent — a second signal does not start a second teardown", async () => {
    const closeQueues = jest.fn(async () => {});
    const exit = jest.fn();

    const shutdownController = createGracefulShutdown({
      server: makeServer([]),
      closeQueues,
      logger: silentLogger,
      exit,
    });

    await Promise.all([
      shutdownController.shutdown("SIGTERM"),
      shutdownController.shutdown("SIGINT"),
    ]);

    expect(closeQueues).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("reports isShuttingDown() once a signal has been handled", async () => {
    const shutdownController = createGracefulShutdown({
      server: makeServer([]),
      logger: silentLogger,
      exit: jest.fn(),
    });

    expect(shutdownController.isShuttingDown()).toBe(false);
    await shutdownController.shutdown("SIGTERM");
    expect(shutdownController.isShuttingDown()).toBe(true);
  });

  it("continues the remaining steps when one step throws", async () => {
    const order = [];
    const exit = jest.fn();

    const shutdownController = createGracefulShutdown({
      server: makeServer(order),
      closeQueues: jest.fn(async () => {
        throw new Error("worker drain failed");
      }),
      closeDatabase: jest.fn(async () => order.push("db")),
      closeRedis: jest.fn(async () => order.push("redis")),
      logger: silentLogger,
      exit,
    });

    await shutdownController.shutdown("SIGTERM");

    // A failure to drain must not leave Mongo and Redis connections open —
    // that is the leak the old handler produced on every failure path.
    expect(order).toEqual(["http", "db", "redis"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("force-exits when a step never settles", async () => {
    const exit = jest.fn();

    const shutdownController = createGracefulShutdown({
      server: makeServer([]),
      // The exact failure mode that used to hang the process until the platform
      // sent SIGKILL.
      closeQueues: jest.fn(() => new Promise(() => {})),
      forceExitAfterMs: 40,
      logger: silentLogger,
      exit,
    });

    shutdownController.shutdown("SIGTERM");
    await new Promise((r) => setTimeout(r, 120));

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("does not force-exit when shutdown completes inside the deadline", async () => {
    const exit = jest.fn();

    const shutdownController = createGracefulShutdown({
      server: makeServer([]),
      closeQueues: jest.fn(async () => {}),
      forceExitAfterMs: 500,
      logger: silentLogger,
      exit,
    });

    await shutdownController.shutdown("SIGTERM");
    await new Promise((r) => setTimeout(r, 60));

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("tolerates a missing server without throwing", async () => {
    const exit = jest.fn();
    const shutdownController = createGracefulShutdown({
      server: null,
      closeQueues: jest.fn(async () => {}),
      logger: silentLogger,
      exit,
    });

    await expect(
      shutdownController.shutdown("SIGTERM"),
    ).resolves.toBeUndefined();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("skips steps that were not provided", async () => {
    const exit = jest.fn();
    const shutdownController = createGracefulShutdown({
      server: makeServer([]),
      logger: silentLogger,
      exit,
    });

    await expect(shutdownController.shutdown()).resolves.toBeUndefined();
    expect(exit).toHaveBeenCalledWith(0);
  });

  describe("registerSignalHandlers", () => {
    /** Minimal EventEmitter-ish stub so we don't touch the real process. */
    const makeProc = () => {
      const handlers = {};
      return {
        handlers,
        on: (event, fn) => {
          (handlers[event] ||= []).push(fn);
        },
      };
    };

    it("subscribes to SIGTERM, SIGINT and the fatal-error events", () => {
      const proc = makeProc();
      const shutdownController = createGracefulShutdown({
        server: makeServer([]),
        logger: silentLogger,
        exit: jest.fn(),
      });

      shutdownController.registerSignalHandlers(proc);

      expect(Object.keys(proc.handlers).sort()).toEqual([
        "SIGINT",
        "SIGTERM",
        "uncaughtException",
        "unhandledRejection",
      ]);
    });

    it("runs the shutdown sequence when SIGTERM fires", async () => {
      const proc = makeProc();
      const closeQueues = jest.fn(async () => {});
      const shutdownController = createGracefulShutdown({
        server: makeServer([]),
        closeQueues,
        logger: silentLogger,
        exit: jest.fn(),
      });

      shutdownController.registerSignalHandlers(proc);
      await proc.handlers.SIGTERM[0]();

      expect(closeQueues).toHaveBeenCalledTimes(1);
    });

    it("logs an unhandled rejection without tearing the process down", async () => {
      const proc = makeProc();
      const error = jest.fn();
      const closeQueues = jest.fn(async () => {});
      const shutdownController = createGracefulShutdown({
        server: makeServer([]),
        closeQueues,
        logger: { ...silentLogger, error },
        exit: jest.fn(),
      });

      shutdownController.registerSignalHandlers(proc);
      proc.handlers.unhandledRejection[0](new Error("nope"));

      expect(error).toHaveBeenCalled();
      // A rejected promise is a bug to investigate, not a reason to drop
      // in-flight jobs on the floor.
      expect(closeQueues).not.toHaveBeenCalled();
    });

    it("drains and exits non-zero on an uncaught exception", async () => {
      const proc = makeProc();
      const exit = jest.fn();
      const closeQueues = jest.fn(async () => {});
      const shutdownController = createGracefulShutdown({
        server: makeServer([]),
        closeQueues,
        logger: silentLogger,
        exit,
      });

      shutdownController.registerSignalHandlers(proc);
      proc.handlers.uncaughtException[0](new Error("fatal"));
      await new Promise((r) => setTimeout(r, 20));

      expect(closeQueues).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
    });
  });
});
