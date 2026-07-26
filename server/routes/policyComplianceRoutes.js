import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import {
  getDecisionCompliance,
  getPolicyRelatedDecisions,
  getComplianceFlags,
  updateFlagStatus,
} from "../controllers/policyComplianceController.js";

const router = express.Router();
router.use(apiLimiter);
router.use(userAuth);
router.use(requireOrgMembership); // compliance data only exists within an organization

router.get(
  "/decisions/:decisionId",
  requirePermission("policies", "view"),
  getDecisionCompliance,
);
router.get(
  "/policies/:policyId/related-decisions",
  requirePermission("policies", "view"),
  getPolicyRelatedDecisions,
);
router.get("/flags", requirePermission("policies", "view"), getComplianceFlags);
router.patch(
  "/flags/:id",
  writeLimiter,
  requirePermission("policies", "edit"),
  updateFlagStatus,
);

export default router;
