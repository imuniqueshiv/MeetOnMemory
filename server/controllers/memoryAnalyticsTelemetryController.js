/**
 * memoryAnalyticsTelemetryController.js
 *
 * Express controller handling Enterprise Memory Analytics Telemetry requests.
 */

import { getEnterpriseMemoryTelemetry } from "../services/memoryAnalyticsTelemetryService.js";
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
 * GET /api/knowledge/analytics/telemetry
 * Returns enterprise memory analytics telemetry metrics for the caller's organization.
 */
export const getEnterpriseMemoryTelemetryController = async (req, res) => {
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

    const telemetry = await getEnterpriseMemoryTelemetry({
      organizationId,
      timeframe,
    });

    return sendSuccess(
      res,
      { telemetry },
      "Enterprise memory analytics telemetry retrieved successfully",
    );
  } catch (error) {
    console.error("getEnterpriseMemoryTelemetryController error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve memory analytics telemetry",
    );
  }
};

export default {
  getEnterpriseMemoryTelemetryController,
};
