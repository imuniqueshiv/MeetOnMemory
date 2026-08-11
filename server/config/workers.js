import { initRedis } from "../services/redisService.js";
import {
  initAIWorker,
  initDataExportWorker,
  initExportCleanupWorker,
  initConflictScanWorker,
  initSentimentWorker,
  initRecalculateImportanceWorker,
  initMemoryLifecycleWorker,
  initRecapDeliveryWorker,
} from "../services/queueService.js";
import { initWebhookWorker } from "../services/webhookDispatcherService.js";

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
  await safeInit("AI Worker", () => initAIWorker(app));
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

  // Pinecone pre-warm is best-effort and independent of the queue layer.
  try {
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
