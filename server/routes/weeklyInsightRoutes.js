import express from "express";
import {
  getLatestInsight,
  getInsightHistory,
  triggerManualGeneration,
  shareWeeklyInsight,
  emailWeeklyInsight,
} from "../controllers/weeklyInsightController.js";
import userAuth from "../middleware/userAuth.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

router.use(userAuth);

router.get(
  "/:orgId/latest",
  requireRole(["owner", "admin", "member"]),
  getLatestInsight,
);
router.get(
  "/:orgId",
  requireRole(["owner", "admin", "member"]),
  getInsightHistory,
);
router.post(
  "/:orgId/generate",
  requireRole(["owner", "admin"]),
  triggerManualGeneration,
);
router.post(
  "/:orgId/insights/:insightId/share",
  requireRole(["owner", "admin"]),
  shareWeeklyInsight,
);
router.post(
  "/:orgId/insights/:insightId/email",
  requireRole(["owner", "admin"]),
  emailWeeklyInsight,
);

export default router;
