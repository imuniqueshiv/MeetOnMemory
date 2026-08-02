/**
 * Issue #975 — background job durability.
 *
 * These suites are intentionally Redis-free. tests/setup.js deletes REDIS_URI so
 * BullMQ never connects, which is exactly the point: the durability policy and
 * the shutdown ordering are pure logic and must be verifiable without
 * infrastructure. Anything that needs a live Redis would never run in CI, and a
 * guarantee that isn't tested is a guarantee that regresses.
 */

import { jest } from "@jest/globals";
import {
  BASE_JOB_OPTIONS,
  QUEUE_DEFINITIONS,
  createQueueRegistry,
  readPositiveIntEnv,
  resolveJobOptions,
  resolveWorkerOptions,
} from "../services/queueRegistry.js";

describe("queueRegistry — durability defaults (Issue #975)", () => {
  describe("every declared queue gets retries and bounded retention", () => {
    const queueNames = Object.keys(QUEUE_DEFINITIONS);

    it("declares at least the seven queues that previously had no defaults", () => {
      expect(queueNames.length).toBeGreaterThanOrEqual(7);
    });

    it.each(queueNames)(
      "%s resolves to attempts > 1 with exponential backoff",
      (name) => {
        const opts = resolveJobOptions(name);

        // The regression this guards: BullMQ's default is attempts: 1, which
        // made every transient failure permanent.
        expect(opts.attempts).toBeGreaterThan(1);
        expect(opts.backoff.type).toBe("exponential");
        expect(opts.backoff.delay).toBeGreaterThan(0);
      },
    );

    it.each(queueNames)("%s bounds completed/failed job retention", (name) => {
      const opts = resolveJobOptions(name);

      // Unbounded retention leaked transcript-bearing payloads into the same
      // Redis that backs the rate limiter and the Socket.IO adapter.
      expect(opts.removeOnComplete).toBeDefined();
      expect(opts.removeOnFail).toBeDefined();
    });
  });

  describe("resolveJobOptions", () => {
    it("falls back to the base options for an unknown queue", () => {
      const opts = resolveJobOptions("queue-that-does-not-exist");

      expect(opts.attempts).toBe(BASE_JOB_OPTIONS.attempts);
      expect(opts.backoff).toEqual({ ...BASE_JOB_OPTIONS.backoff });
    });

    it("lets a queue definition override the base attempts", () => {
      // ai-mom-generation deliberately retries harder than the base default.
      expect(resolveJobOptions("ai-mom-generation").attempts).toBe(5);
      expect(resolveJobOptions("memory-lifecycle-queue").attempts).toBe(2);
    });

    it("lets a per-call override win over the queue definition", () => {
      const opts = resolveJobOptions("ai-mom-generation", { attempts: 9 });
      expect(opts.attempts).toBe(9);
    });

    it("merges backoff field-by-field instead of replacing it wholesale", () => {
      const opts = resolveJobOptions("data-export-queue", {
        backoff: { delay: 1234 },
      });

      expect(opts.backoff.delay).toBe(1234);
      // `type` was not overridden, so it must survive.
      expect(opts.backoff.type).toBe("exponential");
    });

    it("passes through a non-object retention override unchanged", () => {
      // conflictScanTrigger.js historically passed `removeOnComplete: true`.
      // Spreading that into the default object would silently discard the
      // caller's intent, so booleans/numbers must replace rather than merge.
      const opts = resolveJobOptions("conflict-scan-queue", {
        removeOnComplete: true,
        removeOnFail: 50,
      });

      expect(opts.removeOnComplete).toBe(true);
      expect(opts.removeOnFail).toBe(50);
    });

    it("merges an object retention override field-by-field", () => {
      const opts = resolveJobOptions("data-export-queue", {
        removeOnComplete: { count: 5 },
      });

      expect(opts.removeOnComplete.count).toBe(5);
      // `age` came from the base defaults and must be preserved.
      expect(opts.removeOnComplete.age).toBe(
        BASE_JOB_OPTIONS.removeOnComplete.age,
      );
    });

    it("preserves unrelated per-call options such as jobId and repeat", () => {
      const opts = resolveJobOptions("memory-lifecycle-queue", {
        jobId: "scheduled-lifecycle-sweep",
        repeat: { every: 1000 },
      });

      expect(opts.jobId).toBe("scheduled-lifecycle-sweep");
      expect(opts.repeat).toEqual({ every: 1000 });
      // …without losing the durability policy.
      expect(opts.attempts).toBe(2);
    });

    it("returns a fresh object so callers cannot mutate the shared defaults", () => {
      const first = resolveJobOptions("data-export-queue");
      first.attempts = 999;
      first.backoff.delay = 999;
      first.removeOnComplete.count = 999;

      const second = resolveJobOptions("data-export-queue");
      expect(second.attempts).not.toBe(999);
      expect(second.backoff.delay).not.toBe(999);
      expect(second.removeOnComplete.count).not.toBe(999);
    });
  });

  describe("resolveWorkerOptions", () => {
    it("returns the declared concurrency for a known queue", () => {
      expect(resolveWorkerOptions("ai-mom-generation").concurrency).toBe(1);
      expect(resolveWorkerOptions("data-export-queue").concurrency).toBe(2);
    });

    it("merges caller overrides such as the Gemini rate limiter", () => {
      const opts = resolveWorkerOptions("ai-mom-generation", {
        limiter: { max: 5, duration: 60000 },
      });

      expect(opts.concurrency).toBe(1);
      expect(opts.limiter).toEqual({ max: 5, duration: 60000 });
    });

    it("returns an empty object for an unknown queue", () => {
      expect(resolveWorkerOptions("nope")).toEqual({});
    });
  });

  describe("readPositiveIntEnv", () => {
    const KEY = "QUEUE_TEST_ENV_VALUE";
    afterEach(() => {
      delete process.env[KEY];
    });

    it("returns the fallback when unset", () => {
      expect(readPositiveIntEnv(KEY, 42)).toBe(42);
    });

    it("parses a valid positive integer", () => {
      process.env[KEY] = "1500";
      expect(readPositiveIntEnv(KEY, 42)).toBe(1500);
    });

    it.each(["0", "-5", "abc", ""])(
      "falls back for the invalid value %p",
      (value) => {
        process.env[KEY] = value;
        expect(readPositiveIntEnv(KEY, 42)).toBe(42);
      },
    );
  });
});

describe("queueRegistry — shutdown ordering (Issue #975)", () => {
  /** Records the order in which things closed, so ordering can be asserted. */
  const makeTracker = () => {
    const order = [];
    return {
      order,
      worker: (name, impl) => ({
        close: jest.fn(async () => {
          if (impl) await impl();
          order.push(`worker:${name}`);
        }),
      }),
      queue: (name) => ({
        close: jest.fn(async () => {
          order.push(`queue:${name}`);
        }),
      }),
      connection: (name) => ({
        quit: jest.fn(async () => {
          order.push(`connection:${name}`);
        }),
      }),
    };
  };

  const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

  it("closes workers, then queues, then connections", async () => {
    const t = makeTracker();
    const registry = createQueueRegistry({ logger: silentLogger });

    registry.registerWorker("ai", t.worker("ai"));
    registry.registerQueue("ai", t.queue("ai"));
    registry.registerConnection("producer", t.connection("producer"));

    await registry.closeAll();

    // Workers must drain before the connections their in-flight jobs depend on
    // are torn down. Closing connections first is precisely the data loss this
    // registry exists to prevent.
    expect(t.order).toEqual(["worker:ai", "queue:ai", "connection:producer"]);
  });

  it("waits for an in-flight job before reporting the worker closed", async () => {
    const t = makeTracker();
    const registry = createQueueRegistry({ logger: silentLogger });

    let jobFinished = false;
    const slowWorker = t.worker("slow", async () => {
      await new Promise((r) => setTimeout(r, 50));
      jobFinished = true;
    });

    registry.registerWorker("slow", slowWorker);
    await registry.closeAll();

    expect(jobFinished).toBe(true);
  });

  it("is idempotent — a second signal reuses the first teardown", async () => {
    const t = makeTracker();
    const registry = createQueueRegistry({ logger: silentLogger });

    const worker = t.worker("ai");
    registry.registerWorker("ai", worker);

    const [first, second] = await Promise.all([
      registry.closeAll(),
      registry.closeAll(),
    ]);

    expect(worker.close).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("reports isClosing() once shutdown has begun", async () => {
    const registry = createQueueRegistry({ logger: silentLogger });
    expect(registry.isClosing()).toBe(false);
    await registry.closeAll();
    expect(registry.isClosing()).toBe(true);
  });

  it("continues closing the rest when one worker throws", async () => {
    const t = makeTracker();
    const registry = createQueueRegistry({ logger: silentLogger });

    registry.registerWorker("broken", {
      close: jest.fn(async () => {
        throw new Error("boom");
      }),
    });
    const healthy = t.worker("healthy");
    registry.registerWorker("healthy", healthy);
    registry.registerConnection("producer", t.connection("producer"));

    const result = await registry.closeAll();

    expect(healthy.close).toHaveBeenCalled();
    expect(t.order).toContain("connection:producer");
    expect(result.workers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "worker:broken", status: "error" }),
        expect.objectContaining({ name: "worker:healthy", status: "closed" }),
      ]),
    );
  });

  it("gives up on a worker that never closes, rather than hanging forever", async () => {
    const registry = createQueueRegistry({ logger: silentLogger });

    registry.registerWorker("hung", {
      // Never settles — the case that used to turn a graceful shutdown into a
      // SIGKILL.
      close: jest.fn(() => new Promise(() => {})),
    });

    const result = await registry.closeAll({ workerTimeoutMs: 30 });

    expect(result.workers[0]).toEqual(
      expect.objectContaining({ name: "worker:hung", status: "timeout" }),
    );
  });

  it("falls back to disconnect() for a connection without quit()", async () => {
    const registry = createQueueRegistry({ logger: silentLogger });
    const disconnect = jest.fn(async () => {});

    registry.registerConnection("legacy", { disconnect });
    await registry.closeAll();

    expect(disconnect).toHaveBeenCalled();
  });

  it("ignores a null connection", async () => {
    const registry = createQueueRegistry({ logger: silentLogger });
    expect(registry.registerConnection("none", null)).toBeNull();
    await expect(registry.closeAll()).resolves.toBeDefined();
  });

  it("returns the existing queue when the same name is registered twice", () => {
    const registry = createQueueRegistry({ logger: silentLogger });
    const first = { close: jest.fn() };
    const second = { close: jest.fn() };

    expect(registry.registerQueue("dup", first)).toBe(first);
    expect(registry.registerQueue("dup", second)).toBe(first);
    expect(registry.listQueues()).toEqual(["dup"]);
  });

  it("refuses to register a second worker for the same queue", () => {
    // Two workers on one queue would double-process every job.
    const warn = jest.fn();
    const registry = createQueueRegistry({
      logger: { ...silentLogger, warn },
    });
    const first = { close: jest.fn() };
    const second = { close: jest.fn() };

    registry.registerWorker("dup", first);
    expect(registry.registerWorker("dup", second)).toBe(first);
    expect(warn).toHaveBeenCalled();
    expect(registry.listWorkers()).toEqual(["dup"]);
  });

  it("lists registered queues and workers for diagnostics", () => {
    const registry = createQueueRegistry({ logger: silentLogger });
    registry.registerQueue("a", { close: jest.fn() });
    registry.registerWorker("b", { close: jest.fn() });

    expect(registry.listQueues()).toEqual(["a"]);
    expect(registry.listWorkers()).toEqual(["b"]);
  });
});
