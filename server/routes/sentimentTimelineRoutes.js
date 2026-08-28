import express from "express";
import {
  getTimeline,
  generateTimeline,
  getOrgSentimentTrends,
} from "../controllers/sentimentTimelineController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";

const router = express.Router();

router.use(userAuth);
router.use(requireOrgMembership);

// Organization-level sentiment trends
router.get(
  "/organization/:organizationId/trends",
  requirePermission("meetings", "view"),
  getOrgSentimentTrends,
);
router.get(
  "/trends",
  requirePermission("meetings", "view"),
  getOrgSentimentTrends,
);

// Meeting-level sentiment timeline
router.get("/:meetingId", requirePermission("meetings", "view"), getTimeline);
router.post(
  "/:meetingId/generate",
  requirePermission("meetings", "edit"),
  generateTimeline,
);

export default router;
