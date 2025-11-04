import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/mongodb.js";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import { initVectorStore } from "./utils/embeddingUtils.js";
import aiRoutes from "./routes/aiRoutes.js";


import multer from "multer";
const upload = multer({ dest: "uploads/" });

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Global Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// ✅ Serve static uploads
app.use("/uploads", express.static("uploads"));

// ✅ Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/ai-search", aiRoutes);


// ✅ Server initialization
(async () => {
  try {
    await connectDB();
    // await initVectorStore();

    app.listen(PORT, () =>
      console.log(`✅ Server running on port ${PORT}`)
    );
  } catch (error) {
    console.error("❌ Server initialization failed:", error);
  }
})();
