import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/mongodb.js";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";

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

// ✅ Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
