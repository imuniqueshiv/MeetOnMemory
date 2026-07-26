import express from "express";
import { getAnalytics } from "../controllers/analyticsController.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import userAuth from "../middleware/userAuth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

router.get(
  "/",
  apiLimiter,
  userAuth,
  requirePermission("reports", "view"),
  getAnalytics,
);

export default router;
