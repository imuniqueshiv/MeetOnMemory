import express from "express";
import {
    getOkrHierarchy,
    getOkrHealthMetrics,
    getEnterpriseOkrTopology
} from "../controllers/okrController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// Apply auth middleware to all routes in this domain
router.use(authMiddleware);

/**
 * @route GET /api/okr/hierarchy
 * @desc Get the nested objective and key results hierarchy structural nodes
 * @access Private
 */
router.get("/hierarchy", getOkrHierarchy);

/**
 * @route GET /api/okr/health
 * @desc Retrieves confidence scores and cascading health probabilities
 * @access Private
 */
router.get("/health", getOkrHealthMetrics);

/**
 * @route GET /api/okr/topology
 * @desc Fetch big-data topographical distribution of OKR mapping across enterprise teams
 * @access Private
 */
router.get("/topology", getEnterpriseOkrTopology);

export default router;
