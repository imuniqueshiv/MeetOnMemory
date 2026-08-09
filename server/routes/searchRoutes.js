// ================================
// searchRoutes.js
// AI-Powered Semantic Search Routes
// ================================

import express from "express";
import { semanticSearch } from "../controllers/searchController.js";
import { hybridSearch } from "../controllers/hybridSearchController.js";
import { federatedSearch } from "../controllers/federatedSearchController.js";
import { voiceSearch } from "../controllers/transcriptController.js";
import userAuth from "../middleware/userAuth.js";
import { cacheSearch } from "../middleware/cacheMiddleware.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";

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

// POST /api/search/federated
// Federated knowledge graph search across multiple workspaces (Issue #378).
// Searches all organizations the user belongs to, or specific ones via
// the optional `organizationIds` array in the request body.
// Accepts the same options as /api/search/hybrid plus:
//   organizationIds?: string[]  — restrict to specific workspaces
router.post(
  "/federated",
  apiLimiter,
  userAuth,
  requirePermission("ai_search", "search"),
  cacheSearch,
  federatedSearch,
);

// GET /api/search/voice?query=...
// Voice-powered semantic search (frontend VoiceSearchBar contract)
router.get(
  "/voice",
  apiLimiter,
  userAuth,
  requireOrgMembership,
  requirePermission("ai_search", "search"),
  voiceSearch,
);

export default router;
