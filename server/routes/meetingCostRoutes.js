import express from "express";
import {
  getConfig,
  updateConfig,
  getCostAnalytics,
  getMemberAnalytics,
  exportCostReport,
  getMeetingCostDetails,
} from "../controllers/meetingCostController.js";
import userAuth from "../middleware/userAuth.js";
import {
  requireAdminOrOwner,
  requireOrgMembership,
  requirePermission,
} from "../middleware/rbac.js";

import { getEnterpriseCostResourceEngineController } from "../controllers/enterpriseCostResourceEngineController.js";

const router = express.Router();

router.use(userAuth); // All routes require authentication

// Admin/Owner only for config
router
  .route("/config")
  .get(requireAdminOrOwner, getConfig)
  .put(requireAdminOrOwner, updateConfig);

// Meeting specific cost and ROI
router.get("/meeting/:meetingId", getMeetingCostDetails);

// Enterprise Meeting Cost & Resource Engine
router.get(
  "/enterprise-engine",
  requireOrgMembership,
  getEnterpriseCostResourceEngineController,
);

// Analytics endpoints
router.get("/analytics/org", getCostAnalytics);
router.get("/analytics/members", getMemberAnalytics);
router.get(
  "/analytics/export",
  requireOrgMembership,
  requirePermission("analytics", "export"),
  exportCostReport,
);

export default router;
