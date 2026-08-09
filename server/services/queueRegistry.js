// server/services/queueRegistry.js
//
// Issue #975 — Background jobs are silently lost.
//
// Before this module, every BullMQ queue in queueService.js was constructed as
// `new Queue(name, { connection })` with no `defaultJobOptions`. BullMQ's own
// default is `attempts: 1`, so *any* throw — a Redis blip, a Mongo failover, a
// Gemini 429 — permanently destroyed the job. Nothing retried it and nothing
// recorded that it had vanished.
//
// Two queues in this repo already did the right thing by hand
// (webhookDispatcherService.js and MeetingService.js both pass `attempts` +
// `backoff` at enqueue time), which established the intended behaviour. This
// module makes that behaviour the default for *every* queue instead of
// something each caller has to remember, and adds the two other things that
// were missing: bounded retention so Redis memory can't grow without limit,
// and a registry so workers can actually be drained on shutdown.
//
// Deliberately free of any Redis dependency: everything here is pure bookkeeping
// over injected factories, so the option-resolution and shutdown-ordering logic
// is unit-testable in an environment with no Redis (which is exactly how the
// test suite runs — tests/setup.js deletes REDIS_URI).

/**
 * Options applied to every job on every queue unless a queue or an individual
 * `add()` call overrides them.
 *
 * `attempts: 3` with exponential backoff mirrors what
 * webhookDispatcherService.js and MeetingService.js already chose. The
 * retention caps exist because BullMQ otherwise keeps every completed and
 * failed job payload in Redis forever — and `processAudioJob` payloads carry
 * transcript text, so that is an unbounded leak in the same Redis instance that
 * backs the rate limiter and the Socket.IO adapter.
 */
export const BASE_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: Object.freeze({ type: "exponential", delay: 5000 }),
  // Keep a short window of completed jobs for debugging, then evict by count
  // *and* by age so neither a burst nor a slow trickle can grow unbounded.
  removeOnComplete: Object.freeze({ count: 100, age: 24 * 60 * 60 }),
  // Failed jobs are kept longer — they are the ones an operator needs to see.
  removeOnFail: Object.freeze({ count: 500, age: 7 * 24 * 60 * 60 }),
});

/**
 * Per-queue overrides, keyed by BullMQ queue name.
 *
 * The rationale for each deviation from BASE_JOB_OPTIONS is recorded inline so
 * a future reader can tell an intentional choice from an accidental one.
 */
export const QUEUE_DEFINITIONS = Object.freeze({
  "ai-mom-generation": Object.freeze({
    // MoM generation is the most user-visible job and the most likely to hit a
    // transient provider error (the worker's own limiter comment acknowledges
    // Gemini free-tier rate limits). Retry harder, and back off further so a
    // quota window has time to reset.
    jobOptions: { attempts: 5, backoff: { type: "exponential", delay: 15000 } },
    workerOptions: { concurrency: 1 },
  }),
  "data-export-queue": Object.freeze({
    // Exports write a file and email a link; a duplicate delivery is far less
    // bad than a silently dropped export, so retries stay on.
    jobOptions: { attempts: 3 },
    workerOptions: { concurrency: 2 },
  }),
  "conflict-scan-queue": Object.freeze({
    jobOptions: { attempts: 3 },
    workerOptions: { concurrency: 2 },
  }),
  "sentiment-analysis-queue": Object.freeze({
    jobOptions: { attempts: 3, backoff: { type: "exponential", delay: 10000 } },
    workerOptions: { concurrency: 1 },
  }),
  "recalculate-importance-queue": Object.freeze({
    jobOptions: { attempts: 3 },
    workerOptions: { concurrency: 1 },
  }),
  "memory-lifecycle-queue": Object.freeze({
    // The lifecycle sweep is idempotent and re-runs on a schedule anyway, so a
    // long retry tail buys nothing; fail fast and let the next sweep pick it up.
    jobOptions: { attempts: 2 },
    workerOptions: { concurrency: 1 },
  }),
  "recap-delivery-queue": Object.freeze({
    jobOptions: { attempts: 3 },
    workerOptions: { concurrency: 2 },
  }),
  "webhook-dispatches": Object.freeze({
    // These values already existed inline in webhookDispatcherService.js; they
    // are recorded here so the webhook queue picks up the shared retention caps
    // and joins the shutdown registry without changing its dispatch semantics.
    jobOptions: { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
    workerOptions: { concurrency: 10 },
  }),
});

/**
 * Reads a positive integer from the environment, falling back when the value is
 * absent, unparseable, or non-positive.
 *
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
export const readPositiveIntEnv = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

/**
 * Merges a retention setting (`removeOnComplete` / `removeOnFail`).
 *
 * BullMQ accepts three shapes for these: a boolean, a number (keep N), or an
 * object (`{ count, age }`). Only the object form can be merged field-by-field;
 * a boolean or number is a complete replacement and must be passed through
 * untouched. Blindly spreading here would turn an existing caller's
 * `removeOnComplete: true` into `{...base, ...true}` — i.e. silently back into
 * the default object — which would quietly discard their intent.
 *
 * @param {...(boolean|number|object|undefined)} sources lowest precedence first
 */
const mergeRetention = (...sources) => {
  let result;
  for (const source of sources) {
    if (source === undefined || source === null) continue;
    if (typeof source !== "object") {
      // Boolean/number: an outright replacement, not a partial override.
      result = source;
      continue;
    }
    result =
      typeof result === "object" ? { ...result, ...source } : { ...source };
  }
  return result;
};

/**
 * Merges BASE_JOB_OPTIONS with the queue's declared overrides and any
 * caller-supplied overrides. Later sources win. Nested `backoff` and the
 * retention settings are merged rather than replaced wholesale, so a queue can
 * override only `delay` or only `count`.
 *
 * @param {string} queueName
 * @param {object} [overrides]
 * @returns {object} fully resolved defaultJobOptions
 */
export const resolveJobOptions = (queueName, overrides = {}) => {
  const declared = QUEUE_DEFINITIONS[queueName]?.jobOptions ?? {};

  return {
    ...BASE_JOB_OPTIONS,
    ...declared,
    ...overrides,
    backoff: {
      ...BASE_JOB_OPTIONS.backoff,
      ...(declared.backoff ?? {}),
      ...(overrides.backoff ?? {}),
    },
    // Spread copies the frozen nested objects by reference; clone them so a
    // caller mutating a returned options object can't corrupt the shared
    // defaults for every other queue.
    removeOnComplete: mergeRetention(
      BASE_JOB_OPTIONS.removeOnComplete,
      declared.removeOnComplete,
      overrides.removeOnComplete,
    ),
    removeOnFail: mergeRetention(
      BASE_JOB_OPTIONS.removeOnFail,
      declared.removeOnFail,
      overrides.removeOnFail,
    ),
  };
};

/**
 * Resolves worker options for a queue, merging the declared defaults with
 * caller overrides.
 *
 * @param {string} queueName
 * @param {object} [overrides]
 * @returns {object}
 */
export const resolveWorkerOptions = (queueName, overrides = {}) => ({
  ...(QUEUE_DEFINITIONS[queueName]?.workerOptions ?? {}),
  ...overrides,
});

/**
 * Creates a registry that tracks every queue, worker and shared connection so
 * they can be closed in the correct order on shutdown.
 *
 * Ordering matters and is the whole point of this thing:
 *   1. workers  — stop accepting new jobs, let in-flight jobs finish
 *   2. queues   — no producers left by this point
 *   3. connections — only once nothing can still issue a Redis command
 *
 * Closing connections first (the naive ordering) makes in-flight jobs fail with
 * a connection error, which is precisely the data loss this is meant to prevent.
 *
 * @param {object} [deps]
 * @param {Console|object} [deps.logger]
 */
export const createQueueRegistry = ({ logger = console } = {}) => {
  /** @type {Map<string, {name: string, queue: object}>} */
  const queues = new Map();
  /** @type {Map<string, {name: string, worker: object}>} */
  const workers = new Map();
  /** @type {Set<{name: string, connection: object}>} */
  const connections = new Set();

  let closing = false;
  /** @type {Promise<object>|null} */
  let closePromise = null;

  /**
   * Registers a queue. Re-registering the same name returns the existing entry
   * so callers can stay lazy without risking duplicates.
   */
  const registerQueue = (name, queue) => {
    if (queues.has(name)) return queues.get(name).queue;
    queues.set(name, { name, queue });
    return queue;
  };

  /**
   * Registers a worker so it can be drained on shutdown. Registering a second
   * worker for a name already present is a bug (it would double-process every
   * job), so it is logged loudly rather than silently accepted.
   */
  const registerWorker = (name, worker) => {
    if (workers.has(name)) {
      logger.warn?.(
        `⚠️ Worker for "${name}" is already registered — ignoring duplicate registration.`,
      );
      return workers.get(name).worker;
    }
    workers.set(name, { name, worker });
    return worker;
  };

  const registerConnection = (name, connection) => {
    if (!connection) return connection;
    connections.add({ name, connection });
    return connection;
  };

  const listQueues = () => [...queues.keys()];
  const listWorkers = () => [...workers.keys()];
  const isClosing = () => closing;

  /**
   * Runs `fn()` but never waits longer than `timeoutMs`.
   *
   * A close that hangs is the failure mode that turns a graceful shutdown into
   * a SIGKILL, so every individual close gets its own budget. Resolves to a
   * result descriptor instead of throwing, because one stuck worker must not
   * prevent the remaining workers from being drained.
   */
  const closeWithTimeout = async (label, fn, timeoutMs) => {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(
        () => resolve({ name: label, status: "timeout" }),
        timeoutMs,
      );
      // Don't let the timer itself hold the event loop open.
      timer.unref?.();
    });

    try {
      const result = await Promise.race([
        Promise.resolve()
          .then(fn)
          .then(() => ({ name: label, status: "closed" })),
        timeout,
      ]);
      if (result.status === "timeout") {
        logger.warn?.(`⚠️ Close timed out after ${timeoutMs}ms: ${label}`);
      }
      return result;
    } catch (err) {
      logger.error?.(`❌ Close failed for ${label}:`, err?.message || err);
      return {
        name: label,
        status: "error",
        error: err?.message || String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * Drains and closes everything, in dependency order.
   *
   * Idempotent: a second call (a second SIGTERM, or a signal arriving while an
   * explicit shutdown is already running) returns the in-flight promise rather
   * than starting a second teardown.
   *
   * @param {object} [options]
   * @param {number} [options.workerTimeoutMs] grace period for in-flight jobs
   * @param {number} [options.closeTimeoutMs]  budget for each queue/connection close
   * @returns {Promise<{workers: object[], queues: object[], connections: object[]}>}
   */
  const closeAll = async ({
    workerTimeoutMs = readPositiveIntEnv(
      "QUEUE_WORKER_CLOSE_TIMEOUT_MS",
      15000,
    ),
    closeTimeoutMs = readPositiveIntEnv("QUEUE_CLOSE_TIMEOUT_MS", 5000),
  } = {}) => {
    if (closing) return closePromise;
    closing = true;

    closePromise = (async () => {
      // 1. Workers first. `worker.close()` stops fetching new jobs and waits for
      //    in-flight ones, which is the entire reason this ordering exists.
      const workerResults = await Promise.all(
        [...workers.values()].map(({ name, worker }) =>
          closeWithTimeout(
            `worker:${name}`,
            () => worker.close(),
            workerTimeoutMs,
          ),
        ),
      );

      // 2. Queues — producers only; safe once workers are done.
      const queueResults = await Promise.all(
        [...queues.values()].map(({ name, queue }) =>
          closeWithTimeout(
            `queue:${name}`,
            () => queue.close(),
            closeTimeoutMs,
          ),
        ),
      );

      // 3. Shared Redis connections last. ioredis exposes `quit()` (graceful)
      //    and `disconnect()` (immediate); prefer the former, fall back to the
      //    latter so a client that only implements one still gets closed.
      const connectionResults = await Promise.all(
        [...connections].map(({ name, connection }) =>
          closeWithTimeout(
            `connection:${name}`,
            () =>
              typeof connection.quit === "function"
                ? connection.quit()
                : connection.disconnect?.(),
            closeTimeoutMs,
          ),
        ),
      );

      queues.clear();
      workers.clear();
      connections.clear();

      return {
        workers: workerResults,
        queues: queueResults,
        connections: connectionResults,
      };
    })();

    return closePromise;
  };

  /** Test-only: returns the registry to a pristine state. */
  const reset = () => {
    queues.clear();
    workers.clear();
    connections.clear();
    closing = false;
    closePromise = null;
  };

  return {
    registerQueue,
    registerWorker,
    registerConnection,
    listQueues,
    listWorkers,
    isClosing,
    closeAll,
    reset,
  };
};

/**
 * The process-wide registry. queueService.js and webhookDispatcherService.js
 * both register into this so a single `closeAll()` drains everything.
 */
const queueRegistry = createQueueRegistry();

export default queueRegistry;
