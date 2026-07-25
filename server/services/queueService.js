import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import processAudioJob from "../jobs/processAudioJob.js";
import exportDataJob from "../jobs/exportDataJob.js";
import conflictScanJob from "./conflictDetection/conflictScanJob.js";
import sentimentAnalysisJob from "../jobs/sentimentAnalysisJob.js";

// BullMQ requires maxRetriesPerRequest to be null
let _producerConnection = null;
let _workerConnection = null;
let _aiQueueInstance = null;
let _dataExportQueueInstance = null;
let _conflictScanQueueInstance = null;
let _sentimentAnalysisQueueInstance = null;

function getProducerConnection() {
  if (!process.env.REDIS_URI) return null;
  if (!_producerConnection) {
    _producerConnection = new Redis(process.env.REDIS_URI, {
      maxRetriesPerRequest: 3, // Fail fast for requests adding tasks to queue
      family: 0,
    });
    _producerConnection.on("error", (err) => {
      console.error("⚠️ BullMQ Producer Redis Connection Error:", err.message);
    });
  }
  return _producerConnection;
}

function getWorkerConnection() {
  if (!process.env.REDIS_URI) return null;
  if (!_workerConnection) {
    _workerConnection = new Redis(process.env.REDIS_URI, {
      maxRetriesPerRequest: null, // Unlimited retries for background workers
      family: 0, // Helps with DNS resolution for some cloud providers
    });
    _workerConnection.on("error", (err) => {
      console.error("⚠️ BullMQ Worker Redis Connection Error:", err.message);
    });
  }
  return _workerConnection;
}

function getAiQueue() {
  if (!process.env.REDIS_URI) return null;
  if (!_aiQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _aiQueueInstance = new Queue("ai-mom-generation", { connection: conn });
    }
  }
  return _aiQueueInstance;
}

function getDataExportQueue() {
  if (!process.env.REDIS_URI) return null;
  if (!_dataExportQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _dataExportQueueInstance = new Queue("data-export-queue", {
        connection: conn,
      });
    }
  }
  return _dataExportQueueInstance;
}

function getConflictScanQueue() {
  if (!process.env.REDIS_URI) return null;
  if (!_conflictScanQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _conflictScanQueueInstance = new Queue("conflict-scan-queue", {
        connection: conn,
      });
    }
  }
  return _conflictScanQueueInstance;
}

function getSentimentAnalysisQueue() {
  if (!process.env.REDIS_URI) return null;
  if (!_sentimentAnalysisQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _sentimentAnalysisQueueInstance = new Queue("sentiment-analysis-queue", {
        connection: conn,
      });
    }
  }
  return _sentimentAnalysisQueueInstance;
}

// Wrapper to preserve syntax compatibility
export const aiQueue = {
  add: async (...args) => {
    const q = getAiQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getAiQueue() !== null;
  },
};

export const dataExportQueue = {
  add: async (...args) => {
    const q = getDataExportQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getDataExportQueue() !== null;
  },
};

export const conflictScanQueue = {
  add: async (...args) => {
    const q = getConflictScanQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getConflictScanQueue() !== null;
  },
};

export const sentimentAnalysisQueue = {
  add: async (...args) => {
    const q = getSentimentAnalysisQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getSentimentAnalysisQueue() !== null;
  },
};

export const initAIWorker = (app) => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn("⚠️ Redis not configured. AI Worker will not start.");
    return;
  }

  const worker = new Worker(
    "ai-mom-generation",
    async (job) => await processAudioJob(job, app),
    {
      connection,
      concurrency: 1, // Reduced to prevent concurrent API quota exhaustion
      limiter: {
        max: 5, // Process max 5 jobs
        duration: 60000, // per 60 seconds to match Gemini free tier limits
      },
    },
  );

  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job.id} failed with error:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("❌ AI Worker error:", err.message);
  });

  console.log(
    "✅ AI Worker initialized and listening to ai-mom-generation queue",
  );
};

export const initDataExportWorker = (app) => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn("⚠️ Redis not configured. Data Export Worker will not start.");
    return;
  }

  const worker = new Worker(
    "data-export-queue",
    async (job) => await exportDataJob(job, app),
    { connection, concurrency: 2 },
  );

  worker.on("completed", (job) => {
    console.log(`✅ Data Export Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `❌ Data Export Job ${job.id} failed with error:`,
      err.message,
    );
  });

  worker.on("error", (err) => {
    console.error("❌ Data Export Worker error:", err.message);
  });

  console.log(
    "✅ Data Export Worker initialized and listening to data-export-queue",
  );
};

export const initConflictScanWorker = (app) => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn(
      "⚠️ Redis not configured. Conflict Scan Worker will not start.",
    );
    return;
  }

  const worker = new Worker(
    "conflict-scan-queue",
    async (job) => await conflictScanJob(job, app),
    { connection, concurrency: 2 },
  );

  worker.on("completed", (job) => {
    console.log(`✅ Conflict Scan Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `❌ Conflict Scan Job ${job.id} failed with error:`,
      err.message,
    );
  });

  worker.on("error", (err) => {
    console.error("❌ Conflict Scan Worker error:", err.message);
  });

  console.log(
    "✅ Conflict Scan Worker initialized and listening to conflict-scan-queue",
  );
};

export const initSentimentWorker = (app) => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn("⚠️ Redis not configured. Sentiment Worker will not start.");
    return;
  }

  const worker = new Worker(
    "sentiment-analysis-queue",
    async (job) => await sentimentAnalysisJob(job, app),
    { connection, concurrency: 1 },
  );

  worker.on("completed", (job) => {
    console.log(`✅ Sentiment Analysis Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `❌ Sentiment Analysis Job ${job.id} failed with error:`,
      err.message,
    );
  });

  worker.on("error", (err) => {
    console.error("❌ Sentiment Analysis Worker error:", err.message);
  });

  console.log(
    "✅ Sentiment Analysis Worker initialized and listening to sentiment-analysis-queue",
  );
};
