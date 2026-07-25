import express from "express";
import dotenv from "dotenv";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/mongodb.js";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import membershipRoutes from "./routes/membershipRoutes.js";
import membershipRequestRoutes from "./routes/membershipRequestRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import policyRoutes from "./routes/policyRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import { initCalendarSyncCron } from "./services/calendarSyncService.js";
import knowledgeRoutes from "./routes/knowledgeRoutes.js";
import policyComplianceRoutes from "./routes/policyComplianceRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import slackRoutes from "./routes/slackRoutes.js";
import transcriptRoutes from "./routes/transcriptRoutes.js";
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
import { globalLimiter } from "./middleware/rateLimiter.js"; // eslint-disable-line no-unused-vars
import errorHandler from "./middleware/errorHandler.js";

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
app.use("/api/auth", authRoutes);
app.use(["/api/organization", "/api/organizations"], organizationRoutes);
app.use(["/api/membership", "/api/memberships"], membershipRoutes);
app.use("/api/membership-request", membershipRequestRoutes);
app.use("/api/invitation", invitationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/user", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/compliance", policyComplianceRoutes);
import { slackWebhookParser } from "./middleware/slackWebhookParser.js";

app.use("/api/sessions", sessionRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/slack", slackWebhookParser, slackRoutes);
app.use("/api/transcripts", transcriptRoutes);

// Health check endpoint — registered BEFORE the global rate limiter so
// keep-alive pings (e.g. from GitHub Actions cron job) are never blocked.
app.get(["/health", "/api/health"], (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});
app.use(routes);

// ERROR HANDLING (Must be after routes)
configureErrorHandling(app);

const server = http.createServer(app);

// SOCKET.IO
configureSocket(server, app);

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

// ERROR HANDLER
app.use(errorHandler);

// GRACEFUL SHUTDOWN
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    process.exit(0);
  });
});

export { app, server };
