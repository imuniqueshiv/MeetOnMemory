import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import {
  createSeries,
  getSeriesById,
  getSeriesMeetings,
  cancelSeries,
  getSeriesDrift,
  listSeries,
  pauseSeries,
  resumeSeries,
} from "../controllers/meetingSeriesController.js";
import seriesRetrospectiveRoutes from "./seriesRetrospectiveRoutes.js";
import {
  getRoleRotationConfig,
  updateRoleRotationConfig,
  overrideRole,
} from "../controllers/roleRotationController.js";

const router = express.Router();

// Apply auth and organization middlewares
router.use(userAuth);

router.use(requireOrgMembership);

router.post("/", requirePermission("meetings", "create"), createSeries);

// Static collection route must precede "/:id" (Issue #2036).
router.get("/", requirePermission("meetings", "view"), listSeries);

router.get("/:id", requirePermission("meetings", "view"), getSeriesById);

router.get(
  "/:id/meetings",
  requirePermission("meetings", "view"),
  getSeriesMeetings,
);

router.get("/:id/drift", requirePermission("meetings", "view"), getSeriesDrift);

router.patch(
  "/:id/cancel",
  requirePermission("meetings", "edit"),
  cancelSeries,
);

router.patch("/:id/pause", requirePermission("meetings", "edit"), pauseSeries);

router.patch(
  "/:id/resume",
  requirePermission("meetings", "edit"),
  resumeSeries,
);

router.use(
  "/:id/retrospective",
  requirePermission("meetings", "view"),
  seriesRetrospectiveRoutes,
);

router.get(
  "/:id/roles/config",
  requirePermission("meetings", "view"),
  getRoleRotationConfig,
);
router.put(
  "/:id/roles/config",
  requirePermission("meetings", "edit"),
  updateRoleRotationConfig,
);
router.post(
  "/:id/roles/override",
  requirePermission("meetings", "edit"),
  overrideRole,
);

export default router;
