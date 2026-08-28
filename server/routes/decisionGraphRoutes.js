import express from "express";
import {
  getDecisionGraph,
  getDecisionNeighbors,
  getDecisionDependencyMatrix,
  createDecision,
  linkDecisions,
  supersedeDecision,
} from "../controllers/decisionGraphController.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";

const router = express.Router();

router.use(apiLimiter);
router.use(userAuth);
router.use(requireOrgMembership);
router.use(requirePermission("knowledge", "view"));

// Get the full decision graph for the current user's organization
router.get("/", getDecisionGraph);

// Get 2D decision dependency matrix
router.get("/matrix", getDecisionDependencyMatrix);

// Get immediate neighbors for a specific decision
router.get("/:id/neighbors", getDecisionNeighbors);

// --- Mutations (Issue #2027) — view is enforced above; these add create/edit.
// Viewers/guests lack knowledge:create|edit, so they remain read-only.

// Create a new decision node
router.post("/", requirePermission("knowledge", "create"), createDecision);

// Link this decision to another (relatesTo edge)
router.post(
  "/:id/relations",
  requirePermission("knowledge", "edit"),
  linkDecisions,
);

// Mark this decision as superseded by another
router.post(
  "/:id/supersede",
  requirePermission("knowledge", "edit"),
  supersedeDecision,
);

export default router;
