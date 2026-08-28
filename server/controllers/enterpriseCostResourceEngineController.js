/**
 * enterpriseCostResourceEngineController.js
 *
 * Express controller handling Enterprise Meeting Cost & Resource Engine requests.
 */

import { getEnterpriseCostResourceEngineMetrics } from "../services/enterpriseCostResourceEngineService.js";
import { sendError, sendSuccess } from "../utils/responseHandler.js";

const getOrganizationId = (req) => {
  return (
    req.organization?._id ||
    req.user?.organization ||
    req.query?.organizationId ||
    null
  );
};

/**
 * GET /api/meeting-cost/enterprise-engine
 * Returns Enterprise Meeting Cost & Resource Engine metrics for the caller's organization.
 */
export const getEnterpriseCostResourceEngineController = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return sendError(res, 400, "Organization context is required");
    }

    const timeframe = req.query?.timeframe || "30d";
    const allowedTimeframes = ["7d", "30d", "90d", "1y", "all"];

    if (!allowedTimeframes.includes(timeframe)) {
      return sendError(
        res,
        400,
        `Invalid timeframe. Allowed values: ${allowedTimeframes.join(", ")}`,
      );
    }

    const telemetry = await getEnterpriseCostResourceEngineMetrics({
      organizationId,
      timeframe,
    });

    return sendSuccess(
      res,
      { telemetry },
      "Enterprise meeting cost and resource engine telemetry retrieved successfully",
    );
  } catch (error) {
    console.error("getEnterpriseCostResourceEngineController error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve meeting cost and resource telemetry",
    );
  }
};

export default {
  getEnterpriseCostResourceEngineController,
};
