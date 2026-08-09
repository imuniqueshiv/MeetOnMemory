import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import {
  createRule,
  getRules,
  getRuleById,
  updateRule,
  deleteRule,
  toggleRuleStatus,
} from "../controllers/automationRuleController.js";

const router = express.Router();

// Authenticated org members only; action checks use the shared RBAC map.
router.use(userAuth);
router.use(requireOrgMembership);

router.post("/", requirePermission("automation_rules", "create"), createRule);
router.get("/", requirePermission("automation_rules", "view"), getRules);
router.get("/:id", requirePermission("automation_rules", "view"), getRuleById);
router.put("/:id", requirePermission("automation_rules", "edit"), updateRule);
router.patch(
  "/:id/toggle",
  requirePermission("automation_rules", "edit"),
  toggleRuleStatus,
);
router.delete(
  "/:id",
  requirePermission("automation_rules", "delete"),
  deleteRule,
);

export default router;
