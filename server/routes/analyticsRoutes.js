import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getMeetingAnalytics,
  triggerAnalysis,
  getOrganizationAnalyticsEndpoint,
  getSpeakerBreakdown,
  getTrends,
  getAnalytics,
  getTeamAnalyticsSummary,
  getTeamRecentMeetings,
  getOrgTimeline,
} from "../controllers/meetingAnalyticsController.js";

const router = express.Router();

router.use(userAuth);

router.get("/org-timeline", getOrgTimeline);

// Aggregated summary analytics (Reports page)
router.get("/", getAnalytics);

// Meeting-specific analytics
// Canonical plural paths used by MeetingAnalytics.jsx
router.get("/meetings/:meetingId", getMeetingAnalytics);
router.post("/analyze/:meetingId", triggerAnalysis);
router.get("/speakers/:meetingId", getSpeakerBreakdown);

// Singular alias preserved for AnalyticsDashboard / MeetingAnalyticsDetail
// (orphaned analytics.routes.js used /meeting/:id)
router.get("/meeting/:meetingId", getMeetingAnalytics);

// Organization-wide analytics
router.get("/organization/:orgId", getOrganizationAnalyticsEndpoint);
router.get("/trends/:orgId", getTrends);

// Team summary / recent — migrated from orphaned analytics.routes.js
router.get("/team/:teamId/summary", getTeamAnalyticsSummary);
router.get("/team/:teamId/recent", getTeamRecentMeetings);

export default router;
