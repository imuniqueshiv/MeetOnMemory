import express from "express";
import Meeting from "../models/meetingModel.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgAccess, requirePermission } from "../middleware/rbac.js";
import {
  getMappings,
  suggestMappings,
  saveAndApplyMapping,
  revertMapping,
} from "../controllers/speakerMappingController.js";

const router = express.Router();

router.use(userAuth);

// Issue #1378: resolve the meeting server-side and enforce org membership
// before any speaker-mapping read/write. Never trust meetingId alone.
router.get(
  "/:meetingId",
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getMappings,
);
router.get(
  "/:meetingId/suggest",
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  suggestMappings,
);
router.post(
  "/:meetingId",
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  saveAndApplyMapping,
);
router.delete(
  "/:meetingId/:mappingId",
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  revertMapping,
);

export default router;
