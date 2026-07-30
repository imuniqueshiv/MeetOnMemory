import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getMemberAttendanceStats,
  getAttendanceHeatmap,
  getAttendanceTrends,
  getMeetingTypeBreakdown,
} from "../controllers/attendanceAnalyticsController.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(userAuth);

router.get("/stats", getMemberAttendanceStats);
router.get("/heatmap", getAttendanceHeatmap);
router.get("/trends", getAttendanceTrends);
router.get("/types", getMeetingTypeBreakdown);

export default router;
