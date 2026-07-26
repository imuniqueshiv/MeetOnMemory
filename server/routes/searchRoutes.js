// ================================
// searchRoutes.js
// AI-Powered Semantic Search Routes
// ================================

import express from "express";
import { semanticSearch } from "../controllers/searchController.js";
import { hybridSearch } from "../controllers/hybridSearchController.js";
import userAuth from "../middleware/userAuth.js";
import { cacheSearch } from "../middleware/cacheMiddleware.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// 🔹 POST /api/search
// Protected route — requires login (JWT cookie)
// Expects: { query: "attendance policy" }
router.post(
  "/",
  apiLimiter,
  userAuth,
  requirePermission("ai_search", "search"),
  cacheSearch,
  semanticSearch,
);

// 🔹 POST /api/search/hybrid
// Semantic vector search fused with knowledge-graph multi-hop traversal.
// Additive - does not change the behavior of POST /api/search above.
// Expects: { query: "...", topK?, semanticWeight?, graphWeight?, maxHops? }
router.post(
  "/hybrid",
  apiLimiter,
  userAuth,
  requirePermission("ai_search", "search"),
  cacheSearch,
  hybridSearch,
);

export default router;
