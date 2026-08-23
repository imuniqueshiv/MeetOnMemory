import express from "express";
import {
  getMemorySentimentTimeline,
  getMemoryEntityHeatmap,
  getEnterpriseAnalyticsSummary,
} from "../controllers/memoryAnalyticsController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// Apply auth middleware to all routes in this domain
router.use(authMiddleware);

/**
 * @route GET /api/memory-analytics/timeline
 * @desc Fetch structured sentiment trend data spanning the history of recorded memories
 * @access Private
 */
router.get("/timeline", getMemorySentimentTimeline);

/**
 * @route GET /api/memory-analytics/entities
 * @desc Retrieve an algorithmic clustering of entities found within memories for the heatmap
 * @access Private
 */
router.get("/entities", getMemoryEntityHeatmap);

/**
 * @route GET /api/memory-analytics/summary
 * @desc Gather high-level enterprise statistics representing the knowledge graph's growth
 * @access Private
 */
router.get("/summary", getEnterpriseAnalyticsSummary);

export default router;
