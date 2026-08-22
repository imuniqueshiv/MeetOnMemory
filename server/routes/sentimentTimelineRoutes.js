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

router.get("/organization/:orgId/trends", getOrgSentimentTrends);
router.get("/:meetingId", requirePermission("meetings", "view"), getTimeline);
router.post(
  "/:meetingId/generate",
  requirePermission("meetings", "edit"),
  generateTimeline,
);

export default router;
