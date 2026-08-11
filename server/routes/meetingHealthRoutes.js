import express from "express";
import {
  getMeetingHealth,
  getOrganizationHealthTrends,
} from "../controllers/meetingHealthController.js";
import userAuth from "../middleware/userAuth.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

// Require authentication for all routes
router.use(userAuth);

// Get health score for a specific meeting
router.get("/:meetingId", getMeetingHealth);

// Get organization-wide trends
// Require admin or manager roles for org-wide insights
router.get(
  "/trends/:organizationId",
  requireRole(["admin", "manager"]),
  getOrganizationHealthTrends,
);

export default router;
