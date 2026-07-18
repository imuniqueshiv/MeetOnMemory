import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import csrf from "csurf";
import { Server } from "socket.io";
import http from "http";

import connectDB from "./config/mongodb.js";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import organizationRoutesNew from "./routes/organizationRoutesNew.js";
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
import knowledgeRoutes from "./routes/knowledgeRoutes.js";
import policyComplianceRoutes from "./routes/policyComplianceRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import slackRoutes from "./routes/slackRoutes.js";

// Import slackService to register its eventBus 'mom.generated' listener.
// The import itself is enough — the listener is set up at module load time.
import "./services/slackService.js";

import { initVectorStore } from "./utils/embeddingUtils.js";
import meetingSocket from "./socket/meetingSocket.js";
import documentSync from "./socket/documentSync.js";
import { initRedis, getRedisClient } from "./services/redisService.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { initAIWorker, initDataExportWorker } from "./services/queueService.js";
import { initWebhookWorker } from "./services/webhookDispatcherService.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import errorHandler from "./middleware/errorHandler.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists, otherwise fallback to .env
const envPath = path.resolve(__dirname, ".env.local");
dotenv.config({ path: envPath });
dotenv.config();

const app = express();
app.set("trust proxy", 1); // Trust first proxy hop (Render, Vercel)
const PORT = process.env.PORT || 4000;

// DATABASE & CACHE
await connectDB();

// MIDDLEWARES
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`Blocked by CORS: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  }),
);

// Capture the raw request body so Slack's signing-secret HMAC verification
// can read it before the JSON/urlencoded parsers consume the stream.
app.use(express.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({
  extended: true,
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(cookieParser());

// Enforce CSRF protection on mutation routes
const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  },
});

app.use((req, res, next) => {
  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  const isAuthRoute = req.path.startsWith("/api/auth");
  const isSyncPath = req.path.startsWith("/sync");
  // Slack cannot send CSRF tokens — exclude all Slack endpoints
  const isSlackRoute = req.path.startsWith("/api/slack");

  if (
    isSafeMethod ||
    isAuthRoute ||
    isSyncPath ||
    isSlackRoute ||
    process.env.NODE_ENV === "test"
  ) {
    return next();
  }
  return csrfProtection(req, res, next);
});

// CSRF token provider
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// VECTOR DB WARMUP
// (Pre-warming moved to server.listen callback for lazy background startup)

// ROUTES
app.use("/api/auth", authRoutes);
app.use(["/api/organization", "/api/organizations"], organizationRoutes);
app.use(["/api/organization/new", "/api/organizations/new"], organizationRoutesNew);
app.use("/api/membership", membershipRoutes);
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
app.use("/api/compliance", policyComplianceRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/slack", slackRoutes);

// Health check endpoint — registered BEFORE the global rate limiter so
// keep-alive pings (e.g. from GitHub Actions cron job) are never blocked.
app.get(["/health", "/api/health"], (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// GLOBAL RATE LIMITER
app.use(globalLimiter);

const server = http.createServer(app);

// SERVER START (Skipped during Jest test execution)
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`🚀 MeetOnMemory Server running on port ${PORT}`);

    // Asynchronously initialize background services after server starts listening
    const safeInit = async (name, initFn) => {
      try {
        await initFn();
      } catch (err) {
        console.error(`⚠️ Failed to initialize background service "${name}":`, err.message || err);
      }
    };

    safeInit("Redis", () => initRedis());
    safeInit("AI Worker", () => initAIWorker(app));
    safeInit("Data Export Worker", () => initDataExportWorker(app));
    safeInit("Webhook Worker", () => initWebhookWorker());
    safeInit("Vector Store", () => initVectorStore());
  });
}

// SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// REDIS PUB/SUB ADAPTER (Horizontal Scaling)
// Enables collaborative editing to work across multiple server instances.
// Gracefully skips if Redis is not configured.
(async () => {
  const redisUri = process.env.REDIS_URI || process.env.REDIS_URL;
  if (redisUri) {
    try {
      const pubClient = createClient({ url: redisUri });
      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) => {
        console.error("❌ Redis PubClient Error:", err.message);
      });
      subClient.on("error", (err) => {
        console.error("❌ Redis SubClient Error:", err.message);
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log(
        "✅ Socket.io Redis Pub/Sub adapter attached (horizontal scaling enabled)",
      );
    } catch (err) {
      console.warn(
        "⚠️  Redis adapter failed — running in single-instance mode:",
        err.message,
      );
    }
  } else {
    console.log(
      "ℹ️  No REDIS_URI/REDIS_URL set — Socket.io running in single-instance mode",
    );
  }
})();

meetingSocket(io);
documentSync(io);
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
