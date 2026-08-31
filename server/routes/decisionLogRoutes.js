import express from "express";
import * as decisionLogController from "../controllers/decisionLogController.js";
import userAuth from "../middleware/userAuth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// Apply authentication to all routes
router.use(userAuth);

// Apply RBAC: Viewing requires knowledge.view
router.get(
  "/",
  requirePermission("knowledge", "view"),
  decisionLogController.getLogByOrg,
);

router.get(
  "/export",
  requirePermission("knowledge", "view"),
  decisionLogController.exportLog,
);

router.get(
  "/timeline",
  requirePermission("knowledge", "view"),
  decisionLogController.getDecisionTimeline,
);

router.get(
  "/overdue",
  requirePermission("knowledge", "view"),
  decisionLogController.getOverdueReviews,
);

// Editing/Creating requires knowledge.edit
router.post(
  "/",
  requirePermission("knowledge", "edit"),
  decisionLogController.createEntry,
);

router.put(
  "/:id/outcome",
  requirePermission("knowledge", "edit"),
  decisionLogController.updateOutcome,
);

router.put(
  "/:id/link-action-items",
  requirePermission("knowledge", "edit"),
  decisionLogController.linkActionItems,
);

router.put(
  "/:id",
  requirePermission("knowledge", "edit"),
  decisionLogController.editEntry,
);

router.delete(
  "/:id",
  requirePermission("knowledge", "edit"),
  decisionLogController.deleteEntry,
);

export default router;
