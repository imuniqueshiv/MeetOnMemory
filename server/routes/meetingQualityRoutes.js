import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  calculateScore,
  getMeetingQualityEndpoint,
  getOrganizationQualityEndpoint,
  getBenchmarks,
  getRecommendations,
  getLeaderboardEndpoint,
  getTrends,
  exportReport,
  getBestPracticesEndpoint,
} from "../controllers/meetingQualityController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(userAuth);

// Quality calculation
router.post("/calculate/:meetingId", calculateScore);
router.get("/meeting/:meetingId", getMeetingQualityEndpoint);

// Organization quality
router.get("/organization/:orgId", getOrganizationQualityEndpoint);
router.get("/benchmarks/:orgId", getBenchmarks);
router.get("/trends/:orgId", getTrends);

// Recommendations and gamification
router.get("/recommendations/:userId", getRecommendations);
router.get("/leaderboard/:orgId", getLeaderboardEndpoint);
router.get("/best-practices/:orgId", getBestPracticesEndpoint);

// Export
router.post("/export/:orgId", exportReport);

export default router;
