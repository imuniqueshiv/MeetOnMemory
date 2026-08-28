import express from "express";
import {
  getRecurringActionItems,
  getRecurringActionItemById,
  createRecurringActionItem,
  updateRecurringActionItem,
  deleteRecurringActionItem,
} from "../controllers/recurringActionItemController.js";
import authMiddleware from "../middleware/userAuth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", requirePermission("tasks", "view"), getRecurringActionItems);
router.get(
  "/:id",
  requirePermission("tasks", "view"),
  getRecurringActionItemById,
);
router.post(
  "/",
  requirePermission("tasks", "create"),
  createRecurringActionItem,
);
router.put(
  "/:id",
  requirePermission("tasks", "edit"),
  updateRecurringActionItem,
);
router.delete(
  "/:id",
  requirePermission("tasks", "delete"),
  deleteRecurringActionItem,
);

export default router;
