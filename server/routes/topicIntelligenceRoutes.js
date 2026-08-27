import express from "express";
import {
  getDashboardData,
  getOrphanedTopics,
  getCoOccurrenceGraph,
  generateBriefing,
  pinTopic,
  hideTopic,
  mergeTopics,
  exportTopicIntelligence,
} from "../controllers/topicIntelligenceController.js";
import protect from "../middleware/userAuth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

router.use(protect);

router.get(
  "/export",
  requirePermission("analytics", "export"),
  exportTopicIntelligence,
);
router.get(
  "/dashboard",
  requirePermission("analytics", "view"),
  getDashboardData,
);
router.get(
  "/orphaned",
  requirePermission("analytics", "view"),
  getOrphanedTopics,
);
router.get(
  "/graph",
  requirePermission("analytics", "view"),
  getCoOccurrenceGraph,
);
router.post(
  "/:clusterId/briefing",
  requirePermission("analytics", "view"),
  generateBriefing,
);

router.put(
  "/:clusterId/pin",
  requirePermission("analytics", "manage"),
  pinTopic,
);
router.put(
  "/:clusterId/hide",
  requirePermission("analytics", "manage"),
  hideTopic,
);
router.post("/merge", requirePermission("analytics", "manage"), mergeTopics);

export default router;
