import MeetingCostConfig, {
  setMemberRateOverrides,
} from "../models/meetingCostConfigModel.js";
import meetingCostService from "../services/meetingCostService.js";
import { Parser } from "json2csv";
import { neutralizeRow } from "../utils/csvSafety.js";

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
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const data = await meetingCostService.getMemberTimeAnalytics(
      orgId,
      startDate,
      endDate,
    );

    const fields = ["name", "email", "totalMeetings", "totalHours"];
    const opts = { fields };
    const parser = new Parser(opts);
    // `name` is a member's own display name. json2csv escapes correctly *for
    // the CSV format*, which is exactly why a value starting with `=`, `+`,
    // `-` or `@` reaches the spreadsheet as a formula and runs on open
    // (Issue #1161). Numeric columns pass through untouched.
    const csv = parser.parse(data.map(neutralizeRow));

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="meeting_cost_report.csv"',
    );
    res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting cost report:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
