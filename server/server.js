import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";

import connectDB from "./config/mongodb.js";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import policyRoutes from "./routes/policyRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";
import notionRoutes from "./routes/notionRoutes.js";

import { initVectorStore } from "./utils/embeddingUtils.js";
import meetingSocket from "./socket/meetingSocket.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ================================
// DATABASE
// ================================
await connectDB();

// ================================
// MIDDLEWARES
// ================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ================================
// CORS
// ================================
const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
    ],
  })
);

// ================================
// STATIC FILES
// ================================
app.use("/uploads", express.static("uploads"));

// ================================
// HEALTH CHECK
// ================================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MeetOnMemory API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// ================================
// ROUTES
// ================================
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/ai-search", aiRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/notion", notionRoutes);

// ================================
// VECTOR STORE INIT
// ================================
try {
  await initVectorStore();
  console.log("✅ Vector store initialized");
} catch (error) {
  console.error("⚠️ Vector store initialization failed:", error.message);
}

// ================================
// START SERVER
// ================================
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed Origins: ${allowedOrigins.join(", ")}`);
});

// ================================
// SOCKET.IO
// ================================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

meetingSocket(io);

// ================================
// ERROR HANDLER
// ================================
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ================================
// GRACEFUL SHUTDOWN
// ================================
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