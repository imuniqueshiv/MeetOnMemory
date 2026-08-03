import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireAdminOrOwner } from "../middleware/rbac.js";
import {
  createRule,
  getRules,
  getRuleById,
  updateRule,
  deleteRule,
  toggleRuleStatus,
} from "../controllers/automationRuleController.js";

const router = express.Router();

// All routes require authentication and admin/owner role
router.use(userAuth);
router.use(requireAdminOrOwner);

router.post("/", createRule);
router.get("/", getRules);
router.get("/:id", getRuleById);
router.put("/:id", updateRule);
router.patch("/:id/toggle", toggleRuleStatus);
router.delete("/:id", deleteRule);

export default router;
