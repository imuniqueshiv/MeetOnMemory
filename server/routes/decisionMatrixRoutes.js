import express from "express";
import {
    getDecisionMatrixTopology,
    getDecisionResolutionMetrics,
    getDecisionRisks
} from "../controllers/decisionMatrixController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

/**
 * @route GET /api/decision-matrix/topology
 * @desc Get decision topological mapping array for the D3/Canvas UI Graph
 * @access Private
 */
router.get("/topology", getDecisionMatrixTopology);

/**
 * @route GET /api/decision-matrix/metrics
 * @desc Retrieves key velocity indicators and monthly resolution outputs
 * @access Private
 */
router.get("/metrics", getDecisionResolutionMetrics);

/**
 * @route GET /api/decision-matrix/risks
 * @desc Retrieves intelligent inferences identifying stalled node dependencies
 * @access Private
 */
router.get("/risks", getDecisionRisks);

export default router;
