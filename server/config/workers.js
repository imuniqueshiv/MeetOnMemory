import { initRedis } from "../services/redisService.js";
import {
  initAIWorker,
  initDataExportWorker,
  initConflictScanWorker,
  initSentimentWorker,
} from "../services/queueService.js";
import { initWebhookWorker } from "../services/webhookDispatcherService.js";

export function startWorkers(app) {
  const safeInit = async (name, initFn) => {
    try {
      await initFn();
    } catch (err) {
      console.error(
        `⚠️ Failed to initialize background service "${name}":`,
        err.message || err,
      );
    }
  };

  safeInit("Redis", () => initRedis());
  safeInit("AI Worker", () => initAIWorker(app));
  safeInit("Data Export Worker", () => initDataExportWorker(app));
  safeInit("Conflict Scan Worker", () => initConflictScanWorker(app));
  safeInit("Webhook Worker", () => initWebhookWorker());
  safeInit("Sentiment Worker", () => initSentimentWorker(app));

  import("../utils/embeddingUtils.js")
    .then(({ preWarmPinecone }) => {
      safeInit("Pinecone DB", () => preWarmPinecone());
    })
    .catch(() => {});
}
