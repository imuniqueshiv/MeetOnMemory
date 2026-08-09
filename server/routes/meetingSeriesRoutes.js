import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import {
  createSeries,
  getSeriesById,
  getSeriesMeetings,
  cancelSeries,
} from "../controllers/meetingSeriesController.js";

const router = express.Router();

// Apply auth and organization middlewares
router.use(userAuth);

router.use(requireOrgMembership);

router.post("/", requirePermission("meetings", "create"), createSeries);

router.get("/:id", requirePermission("meetings", "view"), getSeriesById);

router.get(
  "/:id/meetings",
  requirePermission("meetings", "view"),
  getSeriesMeetings,
);

router.patch(
  "/:id/cancel",
  requirePermission("meetings", "edit"),
  cancelSeries,
);

export default router;
