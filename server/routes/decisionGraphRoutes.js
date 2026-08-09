import express from "express";
import {
  getDecisionGraph,
  getDecisionNeighbors,
} from "../controllers/decisionGraphController.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import userAuth from "../middleware/userAuth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// Get the full decision graph for the current user's organization
router.get(
  "/",
  apiLimiter,
  userAuth,
  requirePermission("knowledge", "view"),
  getDecisionGraph,
);

// Get immediate neighbors for a specific decision
router.get(
  "/:id/neighbors",
  apiLimiter,
  userAuth,
  requirePermission("knowledge", "view"),
  getDecisionNeighbors,
);

export default router;
