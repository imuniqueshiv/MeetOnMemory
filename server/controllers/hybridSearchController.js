// ================================
// hybridSearchController.js
// Handles hybrid (semantic + knowledge-graph) memory retrieval.
// Additive to the existing /api/search (meeting-only) endpoint - existing
// clients of that route are unaffected.
// ================================

import { hybridRetrieve } from "../services/hybridRetrievalService.js";
import { getRedisClient, setSearchCache } from "../services/redisService.js"; // eslint-disable-line no-unused-vars
import { sendSuccess, sendError } from "../utils/responseHandler.js";

/**
 * @desc  Hybrid retrieval: semantic vector search fused with knowledge-graph
 *        multi-hop traversal over decisions, action items and meetings.
 * @route POST /api/search/hybrid
 * @access Private (requires auth)
 *
 * Body:
 *  {
 *    query: string (required),
 *    topK?: number,                 // final result count, default 10
 *    semanticTopK?: number,         // seed candidates before graph expansion
 *    semanticWeight?: number,       // relative weight of vector similarity
 *    graphWeight?: number,          // relative weight of graph connectivity
 *    maxHops?: number,              // graph traversal depth, default 2
 *    decay?: number,                // per-hop score decay (0-1), default 0.6
 *    minEdgeWeight?: number,        // ignore weak relatesTo edges (0-100)
 *    includeTypes?: ("meeting"|"decision"|"actionItem")[]
 *  }
 */
export const hybridSearch = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return sendError(
        res,
        400,
        "Missing request body. Please send a valid JSON with { query: 'your question' }.",
      );
    }

    const { query, ...options } = req.body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return sendError(
        res,
        400,
        "Please provide a valid search query (minimum 3 characters). Example: { query: 'attendance policy' }",
      );
    }

    const organization = req.user?.organization || null;

    console.log(
      `🔀 Hybrid search for query: "${query}" (org: ${organization})`,
    );

    const { results, meta } = await hybridRetrieve(
      query,
      organization,
      options,
    );

    const message = results.length
      ? "Hybrid search successful."
      : "No relevant memories found.";

    const responsePayload = {
      success: true,
      message,
      results,
      meta,
    };

    if (req.cacheKey) {
      await setSearchCache(req.cacheKey, req.organizationId, responsePayload);
    }

    return sendSuccess(res, { results, meta }, message);
  } catch (error) {
    console.error("❌ Hybrid search error:", error);

    if (error.message === "A non-empty query string is required") {
      return sendError(res, 400, error.message);
    }

    sendError(
      res,
      500,
      error.response?.data?.error ||
        error.message ||
        "Server error during hybrid search.",
    );
  }
};
