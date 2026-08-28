// server/controllers/aiController.js
import { searchVectorStore } from "../utils/embeddingUtils.js";
import Membership from "../models/membershipModel.js";
import Meeting from "../models/meetingModel.js";
import { validateAiSearchRequest } from "../utils/validateAiSearchRequest.js";
import logger from "../utils/logger.js";

/**
 * Perform semantic vector search across meetings within the user's accessible organizations.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const aiSearch = async (req, res) => {
  try {
    const { query, filters } = req.body;

    // Validate input
    const validation = validateAiSearchRequest(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.errors,
        results: [],
      });
    }

    logger.info("Received AI search query", {
      userId: req.user ? req.user._id : "anonymous",
      queryLength: query ? query.length : 0,
      hasFilters: !!filters,
    });

    // Get organizations the user belongs to
    const memberships = await Membership.find(
      {
        user: req.user._id,
        status: "active",
      },
      "organization",
    ).lean();
    const userOrgIds = memberships.map((m) => m.organization.toString());

    if (userOrgIds.length === 0) {
      return res.status(400).json({
        error: "Organization context is required",
        results: [],
      });
    }

    const searchFilters = {
      ...(filters || {}),
      organization: userOrgIds,
    };

    // Call vector search with filters
    const results = await searchVectorStore(query, searchFilters);

    if (!results || results.length === 0) {
      return res.json({ query, results: [], count: 0 });
    }

    const meetingIds = results.map((r) => r.meetingId);

    // Enforce RBAC: Fetch matching meetings from DB where the user has access
    const allowedMeetings = await Meeting.find(
      {
        _id: { $in: meetingIds },
        $or: [
          { organization: { $in: userOrgIds } },
          { uploadedBy: req.user._id },
        ],
      },
      "_id",
    ).lean();

    const allowedMeetingIds = new Set(
      allowedMeetings.map((m) => m._id.toString()),
    );

    const authorizedResults = results.filter((r) =>
      allowedMeetingIds.has(r.meetingId.toString()),
    );

    logger.info("Returning authorized AI search results", {
      resultCount: authorizedResults.length,
      userId: req.user ? req.user._id : "anonymous",
    });

    return res.json({
      query,
      results: authorizedResults,
      count: authorizedResults.length,
    });
  } catch (error) {
    logger.error("AI Search Error", error, {
      userId: req.user ? req.user._id : "anonymous",
      queryLength: req.body?.query ? req.body.query.length : 0,
    });
    return res.status(500).json({
      error: error.message || "Search failed",
      results: [],
    });
  }
};
