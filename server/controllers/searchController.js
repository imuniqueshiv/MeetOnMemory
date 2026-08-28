// ================================
// searchController.js
// Handles semantic AI-powered search for meetings
// ================================

import { searchVectorStore } from "../utils/embeddingUtils.js";
import Meeting from "../models/meetingModel.js";
import Membership from "../models/membershipModel.js";
import { setSearchCache } from "../services/redisService.js";
import { buildExplanation } from "../utils/explanationBuilder.js";
import { buildSearchExplainability } from "../utils/searchExplainability.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

/**
 * @desc  Search meetings using AI embeddings
 * @route POST /api/search
 * @access Private (requires auth)
 */
export const semanticSearch = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return sendError(
        res,
        400,
        "Missing request body. Please send a valid JSON with { query: 'your question' }.",
      );
    }

    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return sendError(
        res,
        400,
        "Please provide a valid search query (minimum 3 characters). Example: { query: 'attendance policy' }",
      );
    }

    const memberships = await Membership.find(
      { user: req.user._id, status: "active" },
      "organization",
    ).lean();
    const userOrgIds = memberships.map((m) => m.organization.toString());

    if (userOrgIds.length === 0) {
      return sendError(
        res,
        400,
        "Organization context is required for search.",
      );
    }

    console.log(`🔍 AI Semantic Search for query: "${query}"`);

    const results = await searchVectorStore(query, {
      organization: userOrgIds,
    });

    if (!results || results.length === 0) {
      return sendSuccess(res, { results: [] }, "No relevant meetings found.");
    }

    // Fetch only meetings the authenticated user can access. The transcript
    // evidence builder below receives these already-authorized records.
    const meetingIds = results.map((r) => r.meetingId);
    const meetings = await Meeting.find({
      _id: { $in: meetingIds },
      $or: [
        { organization: { $in: userOrgIds } },
        { uploadedBy: req.user._id },
      ],
    })
      .select(
        "title description summary createdAt date meetingType tags participants transcript encryptedTranscript isTranscriptEncrypted structuredMoM organization",
      )
      .lean();

    const mergedResults = results
      .map((r, index) => {
        const m = meetings.find((mt) => mt._id.toString() === r.meetingId);

        if (!m) return null;

        const searchEvidence = buildSearchExplainability({
          query,
          meeting: m,
          meetingId: r.meetingId,
          similarityScore: r.similarityScore || 0,
          vectorRank: index + 1,
        });

        return {
          meetingId: r.meetingId,
          title: m.title || r.title || "Untitled Meeting",
          summary: m.summary || r.summary || "No summary available.",
          score: (1 - r.similarityScore).toFixed(3),
          similarityScore: r.similarityScore || 0,
          createdAt: m.createdAt || null,
          date: m.date || m.createdAt || null,
          meetingType: m.meetingType || null,
          tags: m.tags || [],
          participants: m.participants || [],
          explanation: buildExplanation({
            type: "meeting",
            semanticScore: r.similarityScore || 0,
            vectorRank: index + 1,
            organization: m.organization?.toString?.() || null,
            searchEvidence,
          }),
        };
      })
      .filter((r) => r !== null);

    const responsePayload = {
      results: mergedResults,
    };

    if (req.cacheKey) {
      await setSearchCache(req.cacheKey, req.organizationId, responsePayload);
    }

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
