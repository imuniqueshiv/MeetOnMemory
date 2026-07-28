import express from "express";
import {
  getActivities,
  getActivityStats,
} from "../controllers/activityController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

router.use(userAuth);
router.use(requireOrgMembership); // Ensures req.user.currentOrganization is set and valid

router.get("/", getActivities);
router.get("/stats", getActivityStats);

export default router;
