import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import processAudioJob from "../jobs/processAudioJob.js";
import exportDataJob from "../jobs/exportDataJob.js";
import conflictScanJob from "./conflictDetection/conflictScanJob.js";
import sentimentAnalysisJob from "../jobs/sentimentAnalysisJob.js";
import recalculateImportanceJob from "../jobs/recalculateImportanceJob.js";
import memoryLifecycleJob from "../jobs/memoryLifecycleJob.js";
import queueRegistry, {
  readPositiveIntEnv,
  resolveJobOptions,
  resolveWorkerOptions,
} from "./queueRegistry.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #975 — Background jobs are silently lost.
//
// This file previously declared seven near-identical queue getters, seven
// near-identical `add()` wrappers, and seven near-identical `initXWorker`
// functions. None of them set `defaultJobOptions`, so every job ran with
// BullMQ's default `attempts: 1` and was destroyed by the first transient
// error; none of them retained a handle to the created Worker, so nothing could
// be drained on shutdown.
//
// Both problems are now solved structurally rather than per-queue: queues and
// workers are built by shared factories that apply the retry/backoff/retention
// defaults from queueRegistry.js and register every handle for shutdown. Adding
// an eighth queue is one table entry, and it cannot accidentally ship without
// retries.
//
// The public API (`aiQueue.add(...)`, `initAIWorker(app)`, …) is unchanged so no
// caller needed to be touched.
// ─────────────────────────────────────────────────────────────────────────────

// BullMQ requires maxRetriesPerRequest to be null on worker connections.
let _producerConnection = null;
let _workerConnection = null;

/** @type {Map<string, import("bullmq").Queue>} */
const _queueInstances = new Map();

const redisConfigured = () => Boolean(process.env.REDIS_URI);

function getProducerConnection() {
  if (!redisConfigured()) return null;
  if (!_producerConnection) {
    _producerConnection = new Redis(process.env.REDIS_URI, {
      maxRetriesPerRequest: 3, // Fail fast for requests adding tasks to queue
      family: 0,
    });
    _producerConnection.on("error", (err) => {
      console.error("⚠️ BullMQ Producer Redis Connection Error:", err.message);
    });
    queueRegistry.registerConnection("bullmq-producer", _producerConnection);
  }
  return _producerConnection;
}

function getWorkerConnection() {
  if (!redisConfigured()) return null;
  if (!_workerConnection) {
    _workerConnection = new Redis(process.env.REDIS_URI, {
      maxRetriesPerRequest: null, // Unlimited retries for background workers
      family: 0, // Helps with DNS resolution for some cloud providers
    });
    _workerConnection.on("error", (err) => {
      console.error("⚠️ BullMQ Worker Redis Connection Error:", err.message);
    });
    queueRegistry.registerConnection("bullmq-worker", _workerConnection);
  }
  return _workerConnection;
}

/**
 * Lazily creates (and memoises) a queue with the shared durability defaults
 * applied. Returns null when Redis is not configured — the historical
 * behaviour, which lets the app boot for frontend-only development.
 *
 * @param {string} name BullMQ queue name
 * @returns {import("bullmq").Queue|null}
 */
function getQueue(name) {
  if (!redisConfigured()) return null;

  const existing = _queueInstances.get(name);
  if (existing) return existing;

  const connection = getProducerConnection();
  if (!connection) return null;

  const queue = new Queue(name, {
    connection,
    // The fix for Problem 1 in #975: every job on every queue now gets
    // attempts + exponential backoff + bounded retention by default.
    defaultJobOptions: resolveJobOptions(name),
  });

  _queueInstances.set(name, queue);
  queueRegistry.registerQueue(name, queue);
  return queue;
}

/**
 * Builds the thin `{ add, isActive }` facade each queue is exported as.
 *
 * Preserves the previous contract exactly: `add()` resolves to null and warns
 * when Redis is absent rather than throwing, so callers in request paths don't
 * need to guard.
 *
 * @param {string} name
 */
const createQueueFacade = (name) => ({
  /**
   * @param {string} jobName
   * @param {object} [data]
   * @param {object} [opts] per-job overrides; merged over the queue defaults
   */
  add: async (jobName, data, opts) => {
    const queue = getQueue(name);
    if (!queue) {
      console.warn(
        `⚠️ Queue operation ignored: Redis is not configured (queue: ${name}).`,
      );
      return null;
    }
    // Explicitly resolve per-call options against the shared defaults. BullMQ
    // would merge `defaultJobOptions` itself, but doing it here means an
    // `opts` object that only sets e.g. `repeat` can't accidentally shadow the
    // retry policy, and it keeps the merge behaviour unit-testable.
    return await queue.add(jobName, data, resolveJobOptions(name, opts ?? {}));
  },
  get isActive() {
    return getQueue(name) !== null;
  },
  /** Exposed for diagnostics and tests. */
  get name() {
    return name;
  },
});

export const aiQueue = createQueueFacade("ai-mom-generation");
export const dataExportQueue = createQueueFacade("data-export-queue");
export const conflictScanQueue = createQueueFacade("conflict-scan-queue");
export const sentimentAnalysisQueue = createQueueFacade(
  "sentiment-analysis-queue",
);
export const recalculateImportanceQueue = createQueueFacade(
  "recalculate-importance-queue",
);
export const memoryLifecycleQueue = createQueueFacade("memory-lifecycle-queue");
export const recapDeliveryQueue = createQueueFacade("recap-delivery-queue");

/**
 * Creates a worker, wires the standard lifecycle logging, and registers it with
 * the shutdown registry.
 *
 * The `failed` handler is the one behavioural addition: it now distinguishes a
 * retry from a final failure. Previously every attempt logged an identical
 * "job failed" line, which made a job that was about to be retried
 * indistinguishable from one that had been abandoned.
 *
 * @param {object} params
 * @param {string} params.name  queue name
 * @param {string} params.label human-readable name for logs
 * @param {Function} params.processor async (job) => any
 * @param {object} [params.workerOptions]
 * @returns {import("bullmq").Worker|null}
 */
function createWorker({ name, label, processor, workerOptions = {} }) {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn(`⚠️ Redis not configured. ${label} will not start.`);
    return null;
  }

  const worker = new Worker(name, processor, {
    connection,
    ...resolveWorkerOptions(name, workerOptions),
  });

  worker.on("completed", (job) => {
    console.log(`✅ ${label}: job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    // `job` can be undefined when BullMQ fails before it can load the job.
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 1;
    const willRetry = attemptsMade < maxAttempts;

    if (willRetry) {
      console.warn(
        `↻ ${label}: job ${job?.id} failed attempt ${attemptsMade}/${maxAttempts}, will retry — ${err?.message}`,
      );
    } else {
      console.error(
        `❌ ${label}: job ${job?.id} permanently failed after ${attemptsMade}/${maxAttempts} attempts — ${err?.message}`,
      );
    }
  });

  worker.on("error", (err) => {
    console.error(`❌ ${label} error:`, err?.message || err);
  });

  // Surfacing stalls matters here: a stalled job is exactly the case that used
  // to disappear without a trace, because with attempts:1 BullMQ had nothing
  // left to re-deliver.
  worker.on("stalled", (jobId) => {
    console.warn(`⚠️ ${label}: job ${jobId} stalled and will be re-queued.`);
  });

  queueRegistry.registerWorker(name, worker);
  console.log(`✅ ${label} initialized and listening to ${name}`);
  return worker;
}

export const initAIWorker = (app) =>
  createWorker({
    name: "ai-mom-generation",
    label: "AI Worker",
    processor: async (job) => await processAudioJob(job, app),
    workerOptions: {
      limiter: {
        max: 5, // Process max 5 jobs
        duration: 60000, // per 60 seconds to match Gemini free tier limits
      },
    },
  });

export const initDataExportWorker = (app) =>
  createWorker({
    name: "data-export-queue",
    label: "Data Export Worker",
    processor: async (job) => await exportDataJob(job, app),
  });

export const initConflictScanWorker = (app) =>
  createWorker({
    name: "conflict-scan-queue",
    label: "Conflict Scan Worker",
    processor: async (job) => await conflictScanJob(job, app),
  });

export const initSentimentWorker = (app) =>
  createWorker({
    name: "sentiment-analysis-queue",
    label: "Sentiment Analysis Worker",
    processor: async (job) => await sentimentAnalysisJob(job, app),
  });

export const initRecalculateImportanceWorker = (app) =>
  createWorker({
    name: "recalculate-importance-queue",
    label: "Recalculate Importance Worker",
    processor: async (job) => await recalculateImportanceJob(job, app),
  });

export const initMemoryLifecycleWorker = async (app) => {
  const worker = createWorker({
    name: "memory-lifecycle-queue",
    label: "Memory Lifecycle Worker",
    processor: async (job) => await memoryLifecycleJob(job, app),
  });

  if (!worker) return null;

  // Automatic, recurring sweep (Issue #377 acceptance criterion: memories
  // transition according to configured policies without manual triggering).
  // Runs once a day across all organizations; interval is configurable via
  // env so ops can tune it without a code change.
  const intervalMs = readPositiveIntEnv(
    "LIFECYCLE_SWEEP_INTERVAL_MS",
    24 * 60 * 60 * 1000,
  );

  try {
    await memoryLifecycleQueue.add(
      "scheduled-lifecycle-sweep",
      {},
      {
        repeat: { every: intervalMs },
        jobId: "scheduled-lifecycle-sweep",
      },
    );
  } catch (err) {
    console.error(
      "⚠️ Failed to schedule recurring memory lifecycle sweep:",
      err.message,
    );
  }

  return worker;
};

/**
 * Drains every registered worker, then closes queues and shared Redis
 * connections. Safe to call more than once.
 *
 * Called by the graceful-shutdown handler in server.js. Exported separately so
 * tests and scripts can tear the queue layer down without sending a signal.
 *
 * @param {object} [options] forwarded to the registry's closeAll
 */
export const shutdownQueues = async (options) => {
  const result = await queueRegistry.closeAll(options);
  _queueInstances.clear();
  _producerConnection = null;
  _workerConnection = null;
  return result;
};

/** Diagnostics: which queues and workers are currently live. */
export const getQueueStatus = () => ({
  redisConfigured: redisConfigured(),
  queues: queueRegistry.listQueues(),
  workers: queueRegistry.listWorkers(),
  shuttingDown: queueRegistry.isClosing(),
});
