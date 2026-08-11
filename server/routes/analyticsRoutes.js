import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getMeetingAnalytics,
  triggerAnalysis,
  getOrganizationAnalyticsEndpoint,
  getSpeakerBreakdown,
  getTrends,
} from "../controllers/meetingAnalyticsController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(userAuth);

// Meeting-specific analytics
router.get("/meetings/:meetingId", getMeetingAnalytics);
router.post("/analyze/:meetingId", triggerAnalysis);
router.get("/speakers/:meetingId", getSpeakerBreakdown);

// Organization-wide analytics
router.get("/organization/:orgId", getOrganizationAnalyticsEndpoint);
router.get("/trends/:orgId", getTrends);

export default router;
