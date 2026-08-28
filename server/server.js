import express from "express";
import dotenv from "dotenv";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

import connectDB from "./config/mongodb.js";
import { createGracefulShutdown } from "./utils/gracefulShutdown.js";

import { initCalendarSyncCron } from "./services/calendarSyncService.js";
import { configureExpress, configureErrorHandling } from "./config/express.js";
import { configureSocket } from "./config/socket.js";
import { startWorkers } from "./config/workers.js";
import routes from "./routes/index.js";

// Import side-effect modules that register eventBus listeners
import "./services/slackService.js";
import "./services/cacheInvalidationService.js";
import "./services/conflictScanTrigger.js";

// Import socket handlers (side-effect imports for registration)
import meetingSocket from "./socket/meetingSocket.js"; // eslint-disable-line no-unused-vars
import documentSync from "./socket/documentSync.js"; // eslint-disable-line no-unused-vars
import transcriptSocket from "./socket/transcriptSocket.js"; // eslint-disable-line no-unused-vars

// Import notification event listeners (ACTUALLY USED below)
import { initListeners } from "./events/listeners.js";

// Redis imports (used in socket configuration + graceful shutdown)
import {
  initRedis, // eslint-disable-line no-unused-vars
  getRedisClient, // eslint-disable-line no-unused-vars
  closeRedis,
} from "./services/redisService.js";
import { createAdapter } from "@socket.io/redis-adapter"; // eslint-disable-line no-unused-vars
import { startCalendarSyncJob } from "./jobs/calendarSyncJob.js";
import startPollExpirationJob from "./jobs/pollExpirationJob.js";
import startFollowUpReminderJob from "./jobs/followUpReminderJob.js";
import { initChecklistReminderJob } from "./jobs/checklistReminderJob.js";
import {
  startActionItemReminderJob,
  stopActionItemReminderJob,
} from "./jobs/actionItemReminderJob.js";
import { startRecapBatchJob, stopRecapBatchJob } from "./jobs/recapBatchJob.js";
import gamificationEngine from "./services/gamificationEngine.js";
import { startLeaderboardJob } from "./jobs/leaderboardAggregationJob.js";
import startMeetingPatternJob from "./services/meetingPatternJob.js";
import {
  initAutoBriefingJob,
  stopAutoBriefingJob,
} from "./jobs/autoBriefingJob.js";
import {
  initDataRetentionJob,
  stopDataRetentionJob,
} from "./jobs/dataRetentionJob.js";
import { startEscalationJob, stopEscalationJob } from "./jobs/escalationJob.js";
import {
  startMeetingNudgeJob,
  stopMeetingNudgeJob,
} from "./jobs/meetingNudgeJob.js";
import {
  startWeeklyInsightJob,
  stopWeeklyInsightJob,
} from "./jobs/weeklyInsightJob.js";
import {
  startStandupReportJob,
  stopStandupReportJob,
} from "./jobs/standupReportJob.js";
import {
  startActionItemSlaJob,
  stopActionItemSlaJob,
} from "./jobs/actionItemSlaJob.js";
import { startAbsenteeCatchUpJob } from "./jobs/absenteeCatchUpJob.js";
import startAsyncMeetingSummaryJob from "./jobs/asyncMeetingSummaryJob.js";
import scheduleRecurringActionItemJob from "./jobs/recurringActionItemJob.js";
import {
  startDecisionReviewReminderJob,
  stopDecisionReviewReminderJob,
} from "./jobs/decisionReviewReminderJob.js";
import { createClient } from "redis"; // eslint-disable-line no-unused-vars
import {
  initDataExportWorker, // eslint-disable-line no-unused-vars
  initConflictScanWorker, // eslint-disable-line no-unused-vars
  shutdownQueues,
} from "./services/queueService.js";
import { initWebhookWorker } from "./services/webhookDispatcherService.js"; // eslint-disable-line no-unused-vars
import reminderScheduler from "./services/reminderScheduler.js";

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
// SOCKET.IO — namespaces (including /workspace) registered inside configureSocket (#1399)
const io = configureSocket(server, app);

// Initialize notification event listeners
// This MUST happen after Socket.IO is configured so listeners can emit real-time notifications
if (io) {
  const listenersInitialized = initListeners(io);
  if (listenersInitialized) {
    console.log("✅ Notification event listeners initialized successfully");
  } else {
    console.warn(
      "⚠️ Notification event listeners were already initialized or failed to initialize",
    );
  }
} else {
  console.error(
    "❌ Failed to initialize notification listeners: Socket.IO instance not available",
  );
}

// Initialize gamification hooks
gamificationEngine.init();

// SERVER START (Skipped during Jest test execution)
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`==================================================`);
    console.log(`🚀 MeetOnMemory Server running on port ${PORT}`);

    // Fix #1901: Explicitly initialize the cron runner engine on server startup
    try {
      console.log(`⏳ Initializing background Cron systems...`);
      reminderScheduler.start();
      console.log(`✅ [Service Health]: Meeting Reminder Scheduler active.`);
    } catch (schedulerError) {
      console.error(
        `❌ [Service Error]: Failed to start Reminder Scheduler:`,
        schedulerError,
      );
    }
    console.log(`==================================================`);

    setTimeout(() => {
      startWorkers(app);
    }, 0);
  });

  // Init Calendar Sync Cron
  initCalendarSyncCron();

  // Start calendar sync job
  startCalendarSyncJob();

  // Start poll expiration background job
  startPollExpirationJob(io);

  // Start follow-up reminder background job
  startFollowUpReminderJob();

  // Start checklist reminder job
  initChecklistReminderJob();

  // Start action-item reminder job (Issue #1397)
  startActionItemReminderJob();

  // Start meeting pattern detection job
  startMeetingPatternJob();

  // Start recap batch email jobs (Issue #1398)
  startRecapBatchJob();

  // Start leaderboard aggregation job
  startLeaderboardJob();

  // Start auto pre-meeting briefing job
  initAutoBriefingJob();

  // Start data retention sweep job
  initDataRetentionJob();

  // Start automated escalation job
  startEscalationJob();

  // Start meeting nudge job
  startMeetingNudgeJob();

  // Start weekly insight job
  startWeeklyInsightJob();

  // Start standup report job
  startStandupReportJob();

  // Start Action Item SLA background job
  startActionItemSlaJob();

  // Start Absentee Catch-Up background job
  startAbsenteeCatchUpJob();

  // Start Async Meeting Summary background job
  startAsyncMeetingSummaryJob();

  // Start Recurring Action Item job
  scheduleRecurringActionItemJob();

  // Start Decision Review Reminder job
  startDecisionReviewReminderJob();
}

// (AI, Data Export, and Webhook workers are initialized inside server.listen callback)

// GRACEFUL SHUTDOWN — reuse Issue #975 controller (idempotent, ordered teardown)
const gracefulShutdown = createGracefulShutdown({
  server,
  io,
  stopBackgroundJobs: () => {
    stopActionItemReminderJob();
    stopRecapBatchJob();
    stopAutoBriefingJob();
    stopDataRetentionJob();
    stopEscalationJob();
    stopMeetingNudgeJob();
    stopWeeklyInsightJob();
    stopStandupReportJob();
    stopActionItemSlaJob();
    stopDecisionReviewReminderJob();
  },
  closeQueues: shutdownQueues,
  closeDatabase: () => mongoose.connection.close(),
  closeRedis,
});

gracefulShutdown.registerSignalHandlers();

export { app, server };
