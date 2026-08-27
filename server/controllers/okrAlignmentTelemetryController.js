/**
 * okrAlignmentTelemetryController.js
 *
 * Express controller handling Enterprise OKR Alignment Telemetry requests.
 */

import { getEnterpriseOkrAlignmentTelemetry } from "../services/okrAlignmentTelemetryService.js";
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
 * GET /api/knowledge/analytics/okr-alignment
 * Returns Enterprise OKR Alignment Telemetry metrics for the caller's organization.
 */
export const getEnterpriseOkrAlignmentTelemetryController = async (
  req,
  res,
) => {
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

    const telemetry = await getEnterpriseOkrAlignmentTelemetry({
      organizationId,
      timeframe,
    });

    return sendSuccess(
      res,
      { telemetry },
      "Enterprise OKR alignment telemetry retrieved successfully",
    );
  } catch (error) {
    console.error("getEnterpriseOkrAlignmentTelemetryController error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve OKR alignment telemetry",
    );
  }
};

export default {
  getEnterpriseOkrAlignmentTelemetryController,
};
