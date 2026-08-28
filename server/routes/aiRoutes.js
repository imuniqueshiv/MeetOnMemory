// server/routes/aiRoutes.js
import express from "express";
import { aiSearch } from "../controllers/aiController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// POST /api/ai
router.post("/", userAuth, requirePermission("ai_search", "search"), aiSearch);

export default router;
