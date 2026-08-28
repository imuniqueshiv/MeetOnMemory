import express from "express";
import actionItemSlaController from "../controllers/actionItemSlaController.js";
import requireAuth from "../middleware/userAuth.js";
import {
  requireOrganizationParamMatch,
  requireAdminOrOwner,
} from "../middleware/rbac.js";

const router = express.Router();

router.use(requireAuth);

// Get SLA Config for an organization
router.get(
  "/config/:organizationId",
  requireOrganizationParamMatch("organizationId"),
  actionItemSlaController.getConfig,
);

// Update SLA Config (Admin only)
router.put(
  "/config/:organizationId",
  requireOrganizationParamMatch("organizationId"),
  requireAdminOrOwner,
  actionItemSlaController.updateConfig,
);

// Get Breaches
router.get(
  "/breaches/:organizationId",
  requireOrganizationParamMatch("organizationId"),
  actionItemSlaController.getBreaches,
);

// Get Compliance Stats
router.get(
  "/stats/:organizationId",
  requireOrganizationParamMatch("organizationId"),
  actionItemSlaController.getComplianceStats,
);

// Acknowledge a breach
router.post(
  "/breach/:breachId/acknowledge",
  actionItemSlaController.acknowledgeBreach,
);

// Notify breach assignee (Admin only)
router.post(
  "/breach/:breachId/notify",
  requireAdminOrOwner,
  actionItemSlaController.notifyBreach,
);

export default router;
