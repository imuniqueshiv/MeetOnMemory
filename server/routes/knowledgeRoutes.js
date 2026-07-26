import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";
import {
  getDecisionLineageController,
  getOpenActionItems,
  getDecisions,
  submitMemoryFeedback,
  recalculateImportance,
  updateActionItemStatus,
} from "../controllers/knowledgeController.js";
import {
  runConsolidation,
  getConsolidationHistory,
} from "../controllers/consolidationController.js";
import {
  scanForConflicts,
  getConflicts,
  getConflictDetail,
  resolveConflict,
} from "../controllers/conflictController.js";

const router = express.Router();
router.use(apiLimiter);
router.use(userAuth);

router.get(
  "/decisions",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getDecisions,
);
router.get(
  "/decisions/:id/lineage",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getDecisionLineageController,
);
router.get(
  "/action-items",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getOpenActionItems,
);
router.patch(
  "/action-items/:id",
  writeLimiter,
  requireOrgMembership,
  requirePermission("tasks", "edit"),
  updateActionItemStatus,
);
router.patch(
  "/:type/:id/feedback",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "edit"),
  submitMemoryFeedback,
);

router.post(
  "/importance/recalculate",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "edit"),
  recalculateImportance,
);

// --- Memory Consolidation Engine ---
router.post(
  "/consolidate",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "consolidate"),
  runConsolidation,
);
router.get(
  "/consolidation/history",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getConsolidationHistory,
);

// --- AI-Powered Contradiction Detection & Conflict Resolution (#375) ---
router.post(
  "/conflicts/scan",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "resolve_conflicts"),
  scanForConflicts,
);
router.get(
  "/conflicts",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getConflicts,
);
router.get(
  "/conflicts/:id",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getConflictDetail,
);
router.post(
  "/conflicts/:id/resolve",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "resolve_conflicts"),
  resolveConflict,
);

export default router;
