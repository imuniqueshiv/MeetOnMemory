import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  getMemberAttendanceStats,
  getAttendanceHeatmap,
  getAttendanceTrends,
  getMeetingTypeBreakdown,
} from "../controllers/attendanceAnalyticsController.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(userAuth);

// Apply RBAC middleware - only users with analytics:view permission can access
router.use(requirePermission("analytics", "view"));

// All routes now require both authentication AND analytics:view permission
router.get("/stats", getMemberAttendanceStats);
router.get("/heatmap", getAttendanceHeatmap);
router.get("/trends", getAttendanceTrends);
router.get("/types", getMeetingTypeBreakdown);

export default router;
