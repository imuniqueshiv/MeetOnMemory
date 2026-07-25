// ================================
// searchController.js
// Handles semantic AI-powered search for meetings
// ================================

import { searchVectorStore } from "../utils/embeddingUtils.js";
import Meeting from "../models/meetingModel.js";
import Membership from "../models/membershipModel.js";
import { getRedisClient, setSearchCache } from "../services/redisService.js"; // eslint-disable-line no-unused-vars
import { buildExplanation } from "../utils/explanationBuilder.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

/**
 * @desc  Search meetings using AI embeddings
 * @route POST /api/search
 * @access Private (requires auth)
 */
export const semanticSearch = async (req, res) => {
  try {
    // ✅ Step 1 — Defensive check for body
    if (!req.body || Object.keys(req.body).length === 0) {
      return sendError(
        res,
        400,
        "Missing request body. Please send a valid JSON with { query: 'your question' }.",
      );
    }

    // ✅ Step 2 — Extract query safely
    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return sendError(
        res,
        400,
        "Please provide a valid search query (minimum 3 characters). Example: { query: 'attendance policy' }",
      );
    }

    console.log(`🔍 AI Semantic Search for query: "${query}"`);

    // ✅ Step 3 — Perform vector search
    const results = await searchVectorStore(query);

    if (!results || results.length === 0) {
      return sendSuccess(res, { results: [] }, "No relevant meetings found.");
    }

    // ✅ Step 4 — Get user's active organizations for access control
    const memberships = await Membership.find(
      { user: req.user._id, status: "active" },
      "organization",
    ).lean();
    const userOrgIds = memberships.map((m) => m.organization.toString());

    // ✅ Step 5 — Fetch full meeting data for context, scoped to user's orgs
    const meetingIds = results.map((r) => r.meetingId);
    const meetings = await Meeting.find({
      _id: { $in: meetingIds },
      $or: [
        { organization: { $in: userOrgIds } },
        { uploadedBy: req.user._id },
      ],
    })
      .select("title summary createdAt")
      .lean();

    // ✅ Step 6 — Merge vector results with DB data and filter out deleted meetings
    const mergedResults = results
      .map((r, index) => {
        const m = meetings.find((mt) => mt._id.toString() === r.meetingId);
        // Defense in depth: only return results that still exist in MongoDB
        if (!m) return null;
        return {
          meetingId: r.meetingId,
          title: m?.title || r.title || "Untitled Meeting",
          summary: m?.summary || r.summary || "No summary available.",
          score: (1 - r.similarityScore).toFixed(3),
          createdAt: m?.createdAt || null,
          // FEATURE #270: human-readable explanation of why this result was
          // returned. Meetings don't carry graph/access-history data today
          // (see server/graph/graphIndex.js), so those fields are honestly
          // reported as not applicable rather than faked.
          explanation: buildExplanation({
            type: "meeting",
            semanticScore: r.similarityScore || 0,
            vectorRank: index + 1,
          }),
        };
      })
      .filter((r) => r !== null);

    const responsePayload = {
      results: mergedResults,
    };

    // ✅ Step 7 — Save to Redis Cache (if applicable)
    if (req.cacheKey) {
      await setSearchCache(req.cacheKey, req.organizationId, responsePayload);
    }

    // ✅ Step 8 — Send response
    return sendSuccess(res, responsePayload, "AI Search successful.");
  } catch (error) {
    console.error("❌ Semantic search error:", error);
    const message =
      error.response?.data?.error ||
      error.message ||
      "Server error during semantic search.";
    sendError(res, 500, message);
  }
};
