import express from "express";
import { getDashboardMetrics } from "../controllers/dashboardController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

// Apply auth middleware
router.use(userAuth);
router.use(requireOrgMembership);

router.get("/metrics", getDashboardMetrics);

export default router;
