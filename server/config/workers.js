import {
  initAiResultsWorker,
  initAiGenerationWorker,
  initDataExportWorker,
  initExportCleanupWorker,
  initConflictScanWorker,
  initSentimentWorker,
  initRecalculateImportanceWorker,
  initMemoryLifecycleWorker,
  initRecapDeliveryWorker,
  initPolicyComplianceRetryWorker,
  initEmbeddingReindexWorker,
  initMeetingQuizWorker,
  initTranscriptionWorker,
} from "../services/queueService.js";import { initWebhookWorker } from "../services/webhookDispatcherService.js";
} from "../services/queueService.js";
import { initWebhookWorker } from "../services/webhookDispatcherService.js";
import { registerTopicIntelligenceJob } from "../jobs/topicIntelligenceJob.js";
import { describeRateLimitBacking } from "../middleware/rateLimitStore.js";

/**
 * Boots every background service.
 *
 * Issue #975: `safeInit` was declared `async` but called without `await`, so its
 * try/catch could never actually catch anything an initializer rejected with —
 * the rejection escaped as an unhandled promise rejection instead of producing
 * the intended log line. Nothing recorded which workers came up either, so a
 * worker that silently failed to start was indistinguishable from one that was
 * processing normally.
 *
 * Now every initializer is awaited and the outcome is summarised, so a failed
 * worker is visible in the boot logs instead of being discovered later via jobs
 * that never complete.
 *
 * Initialization is sequential on purpose: these share Redis connections and the
 * log output is far easier to read when it isn't interleaved. The total cost is
 * a handful of milliseconds at boot.
 *
 * @param {import("express").Express} app
 * @returns {Promise<{started: string[], failed: {name: string, error: string}[]}>}
 */
export async function startWorkers(app) {
  const started = [];
  const failed = [];

  const safeInit = async (name, initFn) => {
    try {
      await initFn();
      started.push(name);
    } catch (err) {
      const error = err?.message || String(err);
      failed.push({ name, error });
      console.error(
        `⚠️ Failed to initialize background service "${name}":`,
        error,
      );
    }
  };

  await safeInit("Redis", () => initRedis());

  // Issue #1452: the rate limiters used to bind their store at import time,
  // long before this point, so they always fell back to an in-process
  // MemoryStore and nothing said so. They bind lazily now — this line makes
  // the resulting configuration visible in the boot log either way.
  console.log(describeRateLimitBacking().message);

  await safeInit("AI Results Worker", () => initAiResultsWorker(app));
  await safeInit("Meeting Quiz Worker", () => initMeetingQuizWorker(app));
  await safeInit("AI MoM Worker", () => initAiGenerationWorker(app));
  await safeInit("Data Export Worker", () => initDataExportWorker(app));
  await safeInit("Export Cleanup Worker", () => initExportCleanupWorker());
  await safeInit("Conflict Scan Worker", () => initConflictScanWorker(app));
  await safeInit("Webhook Worker", () => initWebhookWorker());
  await safeInit("Sentiment Worker", () => initSentimentWorker(app));
  await safeInit("Recalculate Importance Worker", () =>
    initRecalculateImportanceWorker(app),
  );
  await safeInit("Memory Lifecycle Worker", () =>
    initMemoryLifecycleWorker(app),
  );
  await safeInit("Recap Delivery Worker", () => initRecapDeliveryWorker());
  await safeInit("Policy Compliance Retry Worker", () =>
    initPolicyComplianceRetryWorker(),
  );
  await safeInit("Embedding Reindex Worker", () =>
    initEmbeddingReindexWorker(),
  );
  await safeInit("Transcription Worker", () => initTranscriptionWorker(app));
  await safeInit("Topic Intelligence Worker", () =>
    registerTopicIntelligenceJob(),
  );

  // Pinecone pre-warm is best-effort and independent of the queue layer.  try {
    const { preWarmPinecone } = await import("../utils/embeddingUtils.js");
    await safeInit("Pinecone DB", () => preWarmPinecone());
  } catch {
    // Module unavailable (optional dependency) — not fatal.
  }

  if (failed.length === 0) {
    console.log(`✅ Background services started (${started.length}).`);
  } else {
    console.warn(
      `⚠️ Background services started with ${failed.length} failure(s): ` +
        failed.map((f) => f.name).join(", "),
    );
  }

  return { started, failed };
}
