// server/routes/aiRoutes.js
import express from "express";
import { searchVectorStore } from "../utils/embeddingUtils.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import Membership from "../models/membershipModel.js";
import Meeting from "../models/meetingModel.js";
import { validateAiSearchRequest } from "../utils/validateAiSearchRequest.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// POST /api/ai-search
router.post(
  "/",
  userAuth,
  requirePermission("ai_search", "search"),
  async (req, res) => {
    try {
      const { query, filters } = req.body;

      // ✅ Validate input
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
        hasFilters: !!filters
      });

      // ✅ Call vector search with filters
      const results = await searchVectorStore(query, filters || {});

      if (!results || results.length === 0) {
        return res.json({ query, results: [], count: 0 });
      }

      const meetingIds = results.map((r) => r.meetingId);

      // ✅ Get organizations the user belongs to
      const memberships = await Membership.find(
        {
          user: req.user._id,
          status: "active",
        },
        "organization",
      ).lean();
      const userOrgIds = memberships.map((m) => m.organization.toString());

      // ✅ Enforce RBAC: Fetch matching meetings from DB where the user has access
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

      // ✅ Debug log
      logger.info("Returning authorized AI search results", {
        resultCount: authorizedResults.length,
        userId: req.user ? req.user._id : "anonymous"
      });

      // ✅ Send response
      res.json({
        query,
        results: authorizedResults,
        count: authorizedResults.length,
      });
    } catch (error) {
      logger.error("AI Search Error", error, {
        userId: req.user ? req.user._id : "anonymous",
        queryLength: req.body?.query ? req.body.query.length : 0
      });
      res.status(500).json({
        error: error.message || "Search failed",
        results: [],
      });
    }
  },
);
export default router;
