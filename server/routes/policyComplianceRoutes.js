import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import {
  getDecisionCompliance,
  getPolicyRelatedDecisions,
  getComplianceFlags,
  updateFlagStatus,
  reEvaluateCompliance,
  getPolicyComplianceWorkerStatus,
} from "../controllers/policyComplianceController.js";import {
  exportComplianceEvidence,
  getPolicyVersionDeepLink,
} from "../controllers/policyComplianceEvidenceController.js";

const router = express.Router();
router.use(apiLimiter);
router.use(userAuth);
router.use(requireOrgMembership);

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
router.get(
  "/policies/:policyId/versions/:version",
  requirePermission("policies", "view"),
  getPolicyVersionDeepLink,
);
router.get(
  "/flags/:id/export",
  requirePermission("policies", "view"),
  exportComplianceEvidence,
);
router.get("/flags", requirePermission("policies", "view"), getComplianceFlags);
router.patch(
  "/flags/:id",
  writeLimiter,
  requirePermission("policies", "edit"),
  updateFlagStatus,
);
router.post(
  "/re-evaluate",
  writeLimiter,
  requirePermission("policies", "edit"),
  reEvaluateCompliance,
);
router.get("/worker-status", getPolicyComplianceWorkerStatus);
export default router;
