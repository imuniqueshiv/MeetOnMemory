import express from "express";
import {
  getActivities,
  exportActivities,
  getActivityStats,
} from "../controllers/activityController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

router.use(userAuth);
router.use(requireOrgMembership);

router.get("/", getActivities);
router.get("/export", exportActivities);
router.get("/stats", getActivityStats);

export default router;
