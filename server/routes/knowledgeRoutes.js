import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";
import {
  getDecisionLineageController,
  getOpenActionItems,
  getDecisions,
  getLifecycleMemories,
  submitMemoryFeedback,
  recalculateImportance,
  updateActionItemStatus,
  toggleActionItemReminderStatus,
  runMemoryLifecycleSweep,
  updateMemoryLifecycleState,
} from "../controllers/knowledgeController.js";
import { bulkTransitionMemoryLifecycle } from "../controllers/memoryLifecycleBulkController.js";
import {
  getMemoryLifecycleRetentionPolicy,
  updateMemoryLifecycleRetentionPolicy,
} from "../controllers/memoryLifecycleRetentionController.js";
import { getEnterpriseMemoryTelemetryController } from "../controllers/memoryAnalyticsTelemetryController.js";
import {
  getArchivedMemoriesWithFacets,
  bulkRestoreArchivedMemories,
} from "../controllers/archiveController.js";
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
import {
  getSnapshots,
  getSnapshot,
  exportSnapshot,
  getSnapshotDiff,
  createManualSnapshot,
} from "../controllers/graphSnapshotController.js";

const router = express.Router();
router.use(apiLimiter);
router.use(userAuth);

// --- Knowledge Graph Snapshots (#714) ---
router.get(
  "/graph/snapshots",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getSnapshots,
);
router.post(
  "/graph/snapshots",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "edit"),
  createManualSnapshot,
);
router.get(
  "/graph/snapshots/diff",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getSnapshotDiff,
);
router.get(
  "/graph/snapshots/:id",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getSnapshot,
);
router.get(
  "/graph/snapshots/:id/export",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  exportSnapshot,
);

router.get(
  "/decisions",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getDecisions,
);
router.get(
  "/archive",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getArchivedMemoriesWithFacets,
);
router.post(
  "/archive/restore",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "manage_lifecycle"),
  bulkRestoreArchivedMemories,
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
  "/action-items/:id/reminders",
  writeLimiter,
  requireOrgMembership,
  requirePermission("tasks", "edit"),
  toggleActionItemReminderStatus,
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

// --- Enterprise Memory Analytics Telemetry ---
router.get(
  "/analytics/telemetry",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getEnterpriseMemoryTelemetryController,
);

// --- Memory Lifecycle Management ---
router.get(
  "/lifecycle",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getLifecycleMemories,
);
router.get(
  "/lifecycle/retention-policy",
  requireOrgMembership,
  requirePermission("knowledge", "manage_lifecycle"),
  getMemoryLifecycleRetentionPolicy,
);
router.patch(
  "/lifecycle/retention-policy",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "manage_lifecycle"),
  updateMemoryLifecycleRetentionPolicy,
);
router.post(
  "/lifecycle/bulk",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "manage_lifecycle"),
  bulkTransitionMemoryLifecycle,
);
router.post(
  "/lifecycle/run",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "manage_lifecycle"),
  runMemoryLifecycleSweep,
);
router.patch(
  "/:type/:id/lifecycle",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "manage_lifecycle"),
  updateMemoryLifecycleState,
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
