import express from "express";
import dotenv from "dotenv";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

import mongoose from "mongoose";
import { createGracefulShutdown } from "./utils/gracefulShutdown.js";
import { shutdownQueues } from "./services/queueService.js";
import { closeRedis } from "./services/redisService.js";

import connectDB from "./config/mongodb.js";

import { initCalendarSyncCron } from "./services/calendarSyncService.js";
import { configureExpress, configureErrorHandling } from "./config/express.js";
import { configureSocket } from "./config/socket.js";
import { startWorkers } from "./config/workers.js";
import routes from "./routes/index.js";

// Import slackService, cacheInvalidationService, and conflictScanTrigger to register eventBus listeners.
import "./services/slackService.js";
import "./services/cacheInvalidationService.js";
// Import conflictScanTrigger to register its eventBus 'mom.generated'
// listener, which enqueues a background contradiction scan per
// organization whenever new decisions/action items are extracted.
import "./services/conflictScanTrigger.js";

import meetingSocket from "./socket/meetingSocket.js"; // eslint-disable-line no-unused-vars
import documentSync from "./socket/documentSync.js"; // eslint-disable-line no-unused-vars
import transcriptSocket from "./socket/transcriptSocket.js"; // eslint-disable-line no-unused-vars
import { initRedis, getRedisClient } from "./services/redisService.js"; // eslint-disable-line no-unused-vars
import { createAdapter } from "@socket.io/redis-adapter"; // eslint-disable-line no-unused-vars
import { startCalendarSyncJob } from "./jobs/calendarSyncJob.js";
import { createClient } from "redis"; // eslint-disable-line no-unused-vars
import {
  initAIWorker, // eslint-disable-line no-unused-vars
  initDataExportWorker, // eslint-disable-line no-unused-vars
  initConflictScanWorker, // eslint-disable-line no-unused-vars
} from "./services/queueService.js";
import { initWebhookWorker } from "./services/webhookDispatcherService.js"; // eslint-disable-line no-unused-vars

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists, otherwise fallback to .env
const envPath = path.resolve(__dirname, ".env.local");
dotenv.config({ path: envPath });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is missing.");
  process.exit(1);
}

// DATABASE & CACHE
await connectDB();

// EXPRESS CONFIGURATION
configureExpress(app);

// ROUTES
app.use(routes);

// ERROR HANDLING (Must be after routes)
configureErrorHandling(app);

const server = http.createServer(app);

// SOCKET.IO
const io = configureSocket(server, app);

// SERVER START (Skipped during Jest test execution)
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`🚀 MeetOnMemory Server running on port ${PORT}`);

    setTimeout(() => {
      startWorkers(app);
    }, 0);
  });

  // Init Calendar Sync Cron
  initCalendarSyncCron();

  // Start calendar sync job
  startCalendarSyncJob();
}

// (AI, Data Export, and Webhook workers are initialized inside server.listen callback)

// GRACEFUL SHUTDOWN
const gracefulShutdown = createGracefulShutdown({
  server,
  io,
  closeQueues: shutdownQueues,
  closeDatabase: () => mongoose.connection.close(),
  closeRedis,
});

gracefulShutdown.registerSignalHandlers();

export { app, server };
