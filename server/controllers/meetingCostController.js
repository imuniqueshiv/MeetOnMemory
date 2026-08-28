import MeetingCostConfig, {
  setMemberRateOverrides,
} from "../models/meetingCostConfigModel.js";
import meetingCostService from "../services/meetingCostService.js";
import { neutralizeRow } from "../utils/csvSafety.js";
import { getOrganizationIdFromReq } from "../middleware/cacheMiddleware.js";
import { stripClientTenantFields } from "../utils/resolveSearchTenant.js";

/**
 * Fields a client may set on the cost config (Issue #1161).
 *
 * `updateConfig` was `Object.assign(config, req.body)`, which copied *every*
 * key of the request body onto the document — including `organization`. That
 * field is `unique`, so a body naming another organization either failed with
 * an `E11000` reported as a generic 500, or, if the target had no config yet,
 * **re-parented the caller's config onto a tenant they do not belong to**.
 * `getConfig` then lazily created a fresh default for the caller's own org, so
 * nothing looked wrong from their side.
 *
 * `requireAdminOrOwner` gates the route, but it establishes that the caller
 * administers *their own* organization, not the target. `createdAt`,
 * `updatedAt` and `_id` were assignable for the same reason.
 *
 * `memberRateOverrides` is handled separately because it needs validation
 * rather than assignment.
 */
const UPDATABLE_CONFIG_FIELDS = [
  "defaultHourlyRate",
  "currency",
  "includePreparationTime",
  "prepTimeMultiplier",
];

export const getConfig = async (req, res) => {
  try {
    const orgId = req.user.organization;
    if (!orgId) {
      return res
        .status(403)
        .json({ success: false, message: "Organization membership required" });
    }

    let config = await MeetingCostConfig.findOne({ organization: orgId });

    if (!config) {
      config = new MeetingCostConfig({ organization: orgId });
      await config.save();
    }

    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error("Error fetching meeting cost config:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const orgId = req.user.organization;
    if (!orgId) {
      return res
        .status(403)
        .json({ success: false, message: "Organization membership required" });
    }

    const updates = req.body ?? {};

    let config = await MeetingCostConfig.findOne({ organization: orgId });
    if (!config) {
      config = new MeetingCostConfig({ organization: orgId });
    }

    for (const field of UPDATABLE_CONFIG_FIELDS) {
      if (Object.hasOwn(updates, field)) config[field] = updates[field];
    }

    if (Object.hasOwn(updates, "memberRateOverrides")) {
      try {
        // Validates and normalizes. A malformed entry is now a 400 that names
        // the offending value — previously a dotted key (i.e. any real email)
        // was dropped without a word and the endpoint answered 200.
        setMemberRateOverrides(config, updates.memberRateOverrides);
      } catch (validationError) {
        return res
          .status(400)
          .json({ success: false, message: validationError.message });
      }
    }

    await config.save();
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Error updating meeting cost config:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getCostAnalytics = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const data = await meetingCostService.getOrganizationCostAnalytics(
      orgId,
      startDate,
      endDate,
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching cost analytics:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

import Meeting from "../models/meetingModel.js";

/**
 * Get financial cost and ROI metrics for a single meeting (Issue #2427).
 */
export const getMeetingCostDetails = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const orgId = req.user.organization;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const config = (await MeetingCostConfig.findOne({
      organization: orgId,
    })) || {
      defaultHourlyRate: 75,
      currency: "USD",
      includePreparationTime: false,
      prepTimeMultiplier: 1.2,
    };

    const participantCount = Math.max(1, meeting.participants?.length || 1);
    const durationMinutes = Math.max(15, meeting.duration || 30);
    const hourlyRate = config.defaultHourlyRate || 75;
    const multiplier = config.includePreparationTime
      ? config.prepTimeMultiplier || 1.2
      : 1.0;

    const hours = (durationMinutes / 60) * multiplier;
    const totalCost = Math.round(participantCount * hours * hourlyRate);

    const decisionsCount = meeting.structuredMoM?.decisions?.length || 0;
    const actionItemsCount = meeting.structuredMoM?.action_items?.length || 0;

    const costPerDecision =
      decisionsCount > 0 ? Math.round(totalCost / decisionsCount) : null;
    const costPerActionItem =
      actionItemsCount > 0 ? Math.round(totalCost / actionItemsCount) : null;

    const budgetThreshold = 250; // default threshold
    const isBudgetExceeded =
      totalCost > budgetThreshold || durationMinutes > 60;

    return res.status(200).json({
      success: true,
      data: {
        totalCost,
        currency: config.currency || "USD",
        hourlyRate,
        participantCount,
        durationMinutes,
        decisionsCount,
        actionItemsCount,
        costPerDecision,
        costPerActionItem,
        isBudgetExceeded,
        budgetThreshold,
      },
    });
  } catch (error) {
    console.error("Error computing meeting cost details:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to compute meeting cost" });
  }
};

export const getMemberAnalytics = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const data = await meetingCostService.getMemberTimeAnalytics(
      orgId,
      startDate,
      endDate,
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching member analytics:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const exportCostReport = async (req, res) => {
  try {
    const orgId = getOrganizationIdFromReq(req);
    if (!orgId) {
      return res.status(403).json({
        success: false,
        message: "Organization membership required",
      });
    }

    const { startDate, endDate } = stripClientTenantFields(req.query || {});

    const data = await meetingCostService.getMemberTimeAnalytics(
      orgId,
      startDate,
      endDate,
    );

    const fields = ["name", "email", "totalMeetings", "totalHours"];
    let csv = "";
    try {
      const { Parser } = await import("json2csv");
      const parser = new Parser({ fields });
      csv = parser.parse(data.map(neutralizeRow));
    } catch (_pkgErr) {
      // Fallback CSV generation
      const rows = data.map((r) => neutralizeRow(r));
      const csvHeader = fields.join(",");
      const csvBody = rows
        .map((r) => fields.map((f) => `"${r[f] ?? ""}"`).join(","))
        .join("\n");
      csv = `${csvHeader}\n${csvBody}`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="meeting_cost_report.csv"',
    );
    res.status(200).send(csv);
  } catch (error) {
    if (
      error?.message?.includes("valid organization") ||
      error?.message?.includes("organization is required")
    ) {
      return res.status(403).json({
        success: false,
        message: "Organization membership required",
      });
    }
    console.error("Error exporting cost report:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
