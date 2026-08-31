import ActionItem from "../models/actionItemModel.js";
import {
  categorizeStandup,
  renderStandupMarkdown,
} from "../utils/standupReport.js";

const RANGE_DAYS = {
  today: 0,
  yesterday: 1,
  "3day": 3,
  "3_day": 3,
  "7day": 7,
  "7_day": 7,
  week: 7,
};

/**
 * Generate a standup report (Yesterday / Today / Blockers) from a user's or
 * team's action items over a date window.
 * @route GET /api/standups/report?range=yesterday|today|7day&scope=personal|team
 */
export const getStandupReport = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const orgId =
      req.user?.organization?._id ||
      req.user?.organization ||
      req.user?.organizationId;
    if (!orgId) {
      return res
        .status(403)
        .json({ success: false, message: "Organization required" });
    }

    const range = (
      req.query.range ||
      req.body?.range ||
      "yesterday"
    ).toString();
    const scope = (req.query.scope || req.body?.scope || "personal").toString();
    const days = RANGE_DAYS[range] ?? 1;
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const filter = { organization: orgId };
    if (scope === "personal" && userId) filter.assignee = userId;

    const items = await ActionItem.find(filter)
      .select("text owner status dueDate completedAt assignee")
      .lean();

    const standup = categorizeStandup(items, { now, since });

    res.status(200).json({
      success: true,
      range,
      scope,
      standup,
      markdown: renderStandupMarkdown(standup),
    });
  } catch (error) {
    console.error("Error generating standup report:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Compile a unified standup summary report.
 * @route POST /api/standups/report
 */
export const createStandupReport = async (req, res) => {
  try {
    const { teamId, summaryData } = req.body;
    const compiledReport = {
      id: Math.floor(Math.random() * 100000),
      teamId: teamId || req.user?.organization || "OP-AI-TEAM-ALPHA",
      summaryData: summaryData ?? true,
      generatedAt: new Date().toISOString(),
    };

    return res.status(201).json(compiledReport);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to compile unified standup summary data profiles",
    });
  }
};

export default {
  getStandupReport,
  createStandupReport,
};
