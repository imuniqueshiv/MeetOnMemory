import express from "express";
import {
  getDecisionImpact,
  updateDecisionImpact,
  getImpactReport,
} from "../controllers/decisionImpactController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// NOTE: Specific routes (like /impact/report) must come BEFORE parameterized routes (like /:decisionId/impact)
// Otherwise, "impact" will be interpreted as a decisionId.

// GET /api/decisions/impact/report
router.get("/impact/report", authMiddleware, getImpactReport);

// GET /api/decisions/:decisionId/impact
router.get("/:decisionId/impact", authMiddleware, getDecisionImpact);

// PUT /api/decisions/:decisionId/impact
router.put("/:decisionId/impact", authMiddleware, updateDecisionImpact);

export default router;
