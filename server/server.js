import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import https from "https";
import connectDB from "./config/mongodb.js";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import { initVectorStore } from "./utils/embeddingUtils.js";
import aiRoutes from "./routes/aiRoutes.js";
import policyRoutes from "./routes/policyRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";

import { Server } from "socket.io";
import meetingSocket from "./socket/meetingSocket.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Allowed origins
const allowedOrigins = [
  "https://localhost:5173", // frontend now HTTPS
];

// ✅ CORS (HTTPS-safe)
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Serve uploads
app.use("/uploads", express.static("uploads"));

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/ai-search", aiRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/gemini", geminiRoutes);

// ✅ Create HTTPS server
const httpsServer = https.createServer(
  {
    key: fs.readFileSync("./localhost-key.pem"),
    cert: fs.readFileSync("./localhost.pem"),
  },
  app
);

// ✅ Socket.io (with HTTPS)
const io = new Server(httpsServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});
meetingSocket(io);

// ✅ Start server
(async () => {
  try {
    await connectDB();
    httpsServer.listen(PORT, () => {
      console.log(`✅ HTTPS Server running on https://localhost:${PORT}`);
      console.log(`🌐 CORS allowed for: ${allowedOrigins.join(", ")}`);
    });
  } catch (error) {
    console.error("❌ Server initialization failed:", error);
  }
})();
