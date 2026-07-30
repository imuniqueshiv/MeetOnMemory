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
router.use(requirePermission("meetings", "create"));

router.post("/", createSeries);
router.get("/:id", getSeriesById);
router.get("/:id/meetings", getSeriesMeetings);
router.patch("/:id/cancel", cancelSeries);

export default router;
