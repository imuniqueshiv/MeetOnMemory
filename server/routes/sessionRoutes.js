import express from "express";
import { generateSession } from "../controllers/sessionController.js";
import userAuth from "../middleware/userAuth.js";
import { writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// Generate session card
router.post(
  "/generate",
  userAuth,
  requirePermission("ai_search", "search"),
  writeLimiter,
  generateSession,
);

export default router;
