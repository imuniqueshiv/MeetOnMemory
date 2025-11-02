import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/mongodb.js";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
// import aiRoutes from "./routes/aiRoutes.js";
import multer from "multer";
const upload = multer({ dest: "uploads/" }); // temporary folder




dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
// static uploads if you need to serve them (optional)
app.use('/uploads', express.static('uploads'));
// app.use('/api/meetings', meetingRoutes);
// ✅ Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/meetings", meetingRoutes);
// app.use("/api/ai", aiRoutes);

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
