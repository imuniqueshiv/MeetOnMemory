import { federatedRetrieve } from "../services/federatedSearchService.js";
import { setSearchCache } from "../services/redisService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

export const federatedSearch = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return sendError(
        res,
        400,
        "Missing request body. Please send a valid JSON with { query: 'your question' }.",
      );
    }

    const { query, organizationIds, ...options } = req.body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return sendError(
        res,
        400,
        "Please provide a valid search query (minimum 3 characters). Example: { query: 'attendance policy' }",
      );
    }

    console.log(
      `Federated search for query: "${query}" across ${
        organizationIds?.length || "all user"
      } workspace(s)`,
    );

    const userId = req.user?._id;

    const { results, meta } = await federatedRetrieve(userId, organizationIds, {
      query,
      ...options,
    });

    const message = results.length
      ? "Federated search successful."
      : "No relevant memories found across workspaces.";

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
    console.error("Federated search error:", error);

    if (error.message === "A non-empty query string is required") {
      return sendError(res, 400, error.message);
    }

    sendError(
      res,
      500,
      error.response?.data?.error ||
        error.message ||
        "Server error during federated search.",
    );
  }
};
