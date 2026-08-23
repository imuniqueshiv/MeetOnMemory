import express from "express";
import {
    getMeetingCostAggregations,
    getResourceTopography,
    getCostMitigationInsights
} from "../controllers/meetingCostEngineController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

/**
 * @route GET /api/cost-engine/aggregations
 * @desc Retrieve structural financial statistics related to meeting utilization
 * @access Private
 */
router.get("/aggregations", getMeetingCostAggregations);

/**
 * @route GET /api/cost-engine/topography
 * @desc Get structural distribution of cost allocation over departments
 * @access Private
 */
router.get("/topography", getResourceTopography);

/**
 * @route GET /api/cost-engine/insights
 * @desc Receive actionable algorithmic savings configurations
 * @access Private
 */
router.get("/insights", getCostMitigationInsights);

export default router;
