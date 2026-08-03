import express from "express";
import {
  getConfig,
  updateConfig,
  getCostAnalytics,
  getMemberAnalytics,
  exportCostReport,
} from "../controllers/meetingCostController.js";
import userAuth from "../middleware/userAuth.js";
import { requireAdminOrOwner } from "../middleware/rbac.js";

const router = express.Router();

router.use(userAuth); // All routes require authentication

// Admin/Owner only for config
router
  .route("/config")
  .get(requireAdminOrOwner, getConfig)
  .put(requireAdminOrOwner, updateConfig);

// Analytics endpoints
router.get("/analytics/org", getCostAnalytics);
router.get("/analytics/members", getMemberAnalytics);
router.get("/analytics/export", exportCostReport);

export default router;
