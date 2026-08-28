import MeetingAnalytics from "../models/MeetingAnalytics.js";
import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import {
  analyzeMeeting,
  getOrganizationAnalytics,
} from "../services/audioAnalyticsService.js";
import mongoose from "mongoose";
import { groupByPeriod } from "../utils/periodBucket.js";

/**
 * Meeting Analytics Controller
 * Handles HTTP requests for meeting analytics endpoints
 */

/**
 * @desc Get analytics for a specific meeting
 * @route GET /api/analytics/meetings/:meetingId
 * @access Private
 */
export const getMeetingAnalytics = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check organization access
    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const analytics = await MeetingAnalytics.findOne({ meeting: meetingId })
      .populate("speakers.userId", "name email profilePicture")
      .populate("meeting", "title date meetingType participants");

    if (!analytics) {
      return res.status(404).json({
        message: "Analytics not found. Trigger analysis first.",
        status: "not_analyzed",
      });
    }

    res.status(200).json(analytics);
  } catch (error) {
    console.error("Error fetching meeting analytics:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Trigger analysis for a meeting
 * @route POST /api/analytics/analyze/:meetingId
 * @access Private
 */
export const triggerAnalysis = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check organization access
    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    // Check if already analyzing
    const existing = await MeetingAnalytics.findOne({ meeting: meetingId });
    if (existing && existing.status === "analyzing") {
      return res.status(400).json({
        message: "Analysis already in progress",
        status: "analyzing",
      });
    }

    // Trigger analysis asynchronously
    analyzeMeeting(meetingId)
      .then(() => {
        console.log(`Analytics completed for meeting ${meetingId}`);
      })
      .catch((error) => {
        console.error(`Analytics failed for meeting ${meetingId}:`, error);
      });

    res.status(202).json({
      message: "Analysis started",
      status: "analyzing",
    });
  } catch (error) {
    console.error("Error triggering analysis:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get organization-wide analytics
 * @route GET /api/analytics/organization/:orgId
 * @access Private
 */
export const getOrganizationAnalyticsEndpoint = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    // Check organization access
    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const analytics = await getOrganizationAnalytics(orgId, filters);

    res.status(200).json(analytics);
  } catch (error) {
    console.error("Error fetching organization analytics:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get speaker breakdown for a meeting
 * @route GET /api/analytics/speakers/:meetingId
 * @access Private
 */
export const getSpeakerBreakdown = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    const analytics = await MeetingAnalytics.findOne({
      meeting: meetingId,
    }).populate("speakers.userId", "name email profilePicture");

    if (!analytics) {
      return res.status(404).json({ message: "Analytics not found" });
    }

    // Check organization access
    if (
      analytics.organization.toString() !== req.user.organization.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const speakerData = analytics.speakers.map((speaker) => ({
      userId: speaker.userId,
      name: speaker.name,
      email: speaker.email,
      totalTime: speaker.totalTime,
      formattedTime: formatDuration(speaker.totalTime),
      interventionCount: speaker.interventionCount,
      averageInterventionLength: speaker.averageInterventionLength,
      formattedAvgLength: formatDuration(speaker.averageInterventionLength),
      percentage: speaker.percentage,
      dominanceScore: speaker.dominanceScore,
    }));

    res.status(200).json({
      speakers: speakerData,
      totalSpeakers: speakerData.length,
      metrics: analytics.metrics,
    });
  } catch (error) {
    console.error("Error fetching speaker breakdown:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get trend data over time
 * @route GET /api/analytics/trends/:orgId
 * @access Private
 */
export const getTrends = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { period = "weekly" } = req.query;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    // Check organization access
    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const analytics = await MeetingAnalytics.find({
      organization: orgId,
      status: "completed",
    })
      .populate("meeting", "title date meetingType")
      .sort({ analyzedAt: -1 })
      .limit(100);

    // Group by period. This used to mix `getDay()`/`setDate()` (local calendar)
    // with `toISOString()` (UTC), which split one week across two buckets on
    // any server whose TZ is not UTC — and it derived the monthly key from
    // local `getFullYear()`/`getMonth()` while the daily key came from UTC, so
    // the three granularities did not agree with each other (Issue #1453).
    const { buckets } = groupByPeriod(analytics, {
      granularity: period,
      getDate: (item) => item.analyzedAt,
    });

    const trends = buckets.map(({ period: periodKey, items }) => {
      const metrics = items.map((a) => a.metrics);
      const average = (pick) =>
        metrics.reduce((sum, m) => sum + pick(m), 0) / metrics.length;

      return {
        period: periodKey,
        meetingCount: items.length,
        avgEngagement: average((m) => m.engagementScore),
        avgParticipationEquity: average((m) => m.participationEquity),
        avgDuration: average((m) => m.totalDuration),
        avgDecisionDensity: average((m) => m.decisionDensity),
      };
    });

    // `groupByPeriod` returns buckets in chronological order, so the
    // `new Date(a.period)` sort that used to run here is gone.
    res.status(200).json({ trends, period });
  } catch (error) {
    console.error("Error fetching trends:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * Authorize a team analytics scope. Always ties results to the caller's
 * organization — never trust teamId alone. When teamId equals the user's org
 * id (common "team = org" usage), return all org analytics; otherwise further
 * filter by MeetingAnalytics.teamId within that org.
 */
const buildTeamAnalyticsMatch = (teamId, user) => {
  if (!user?.organization) {
    return {
      error: {
        status: 403,
        message: "Forbidden: Organization membership required",
      },
    };
  }

  if (!mongoose.isValidObjectId(teamId)) {
    return { error: { status: 400, message: "Invalid team ID" } };
  }

  const match = { organization: user.organization };
  if (teamId !== user.organization.toString()) {
    match.teamId = new mongoose.Types.ObjectId(teamId);
  }

  return { match };
};

/**
 * @desc Aggregated team/org analytics summary (migrated from orphaned analytics.routes.js)
 * @route GET /api/analytics/team/:teamId/summary
 * @access Private
 */
export const getTeamAnalyticsSummary = async (req, res) => {
  try {
    const { teamId } = req.params;
    const scoped = buildTeamAnalyticsMatch(teamId, req.user);
    if (scoped.error) {
      return res
        .status(scoped.error.status)
        .json({ success: false, error: scoped.error.message });
    }

    const summary = await MeetingAnalytics.aggregate([
      { $match: scoped.match },
      {
        $group: {
          _id: null,
          totalMeetings: { $sum: 1 },
          avgEngagement: { $avg: "$engagementScore" },
          avgEfficiency: { $avg: "$efficiencyScore" },
          avgDuration: { $avg: "$duration" },
          avgBalance: { $avg: "$participationBalanceScore" },
        },
      },
    ]);

    res.status(200).json({ success: true, data: summary[0] || {} });
  } catch (error) {
    console.error("Error fetching team analytics summary:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * @desc Recent meetings with joined analytics (migrated from orphaned analytics.routes.js)
 * @route GET /api/analytics/team/:teamId/recent
 * @access Private
 */
export const getTeamRecentMeetings = async (req, res) => {
  try {
    const { teamId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const scoped = buildTeamAnalyticsMatch(teamId, req.user);
    if (scoped.error) {
      return res
        .status(scoped.error.status)
        .json({ success: false, error: scoped.error.message });
    }

    // Meetings are org-scoped (meetingModel has no teamId). When a non-org
    // teamId filter is requested, only return meetings that have analytics
    // tagged with that teamId.
    const meetingMatch = { organization: req.user.organization };
    const analyticsCollection = MeetingAnalytics.collection.collectionName;

    let meetings;
    if (scoped.match.teamId) {
      meetings = await Meeting.aggregate([
        { $match: meetingMatch },
        { $sort: { date: -1 } },
        {
          $lookup: {
            from: analyticsCollection,
            localField: "_id",
            foreignField: "meeting",
            as: "analyticsDocs",
          },
        },
        {
          $addFields: {
            analytics: {
              $first: {
                $filter: {
                  input: "$analyticsDocs",
                  as: "a",
                  cond: { $eq: ["$$a.teamId", scoped.match.teamId] },
                },
              },
            },
          },
        },
        { $match: { analytics: { $ne: null } } },
        { $limit: limit },
        { $project: { analyticsDocs: 0 } },
      ]);
    } else {
      meetings = await Meeting.aggregate([
        { $match: meetingMatch },
        { $sort: { date: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: analyticsCollection,
            localField: "_id",
            foreignField: "meeting",
            as: "analyticsDocs",
          },
        },
        {
          $addFields: {
            analytics: { $first: "$analyticsDocs" },
          },
        },
        { $project: { analyticsDocs: 0 } },
      ]);
    }

    res.status(200).json({
      success: true,
      data: {
        meetings,
        pagination: { limit, total: meetings.length },
      },
    });
  } catch (error) {
    console.error("Error fetching team recent meetings:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * Helper function to format duration in seconds to human-readable format
 */
const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

export const subtractMonthsClamped = (date, months) => {
  const result = new Date(date);
  const dayOfMonth = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() - months);

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  return result;
};

/**
 * @desc Get aggregated analytics summary (meetings, policies, trends)
 * @route GET /api/analytics/
 * @access Private
 */
export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const queryOptions = [{ uploadedBy: userId }];
    if (req.user?.organization) {
      queryOptions.push({ organization: req.user.organization });
    }
    const matchQuery = { $or: queryOptions };

    const totalMeetings = await Meeting.countDocuments(matchQuery);
    const totalPolicies = await Policy.countDocuments(matchQuery);
    const completedMeetings = await Meeting.countDocuments({
      ...matchQuery,
      status: "completed",
    });
    const updatedPolicies = await Policy.countDocuments({
      ...matchQuery,
      version: { $ne: "1.0" },
    });

    // Monthly trend (last 6 months)
    const lastSixMonths = subtractMonthsClamped(new Date(), 5);
    const monthlyMeetings = await Meeting.aggregate([
      { $match: { createdAt: { $gte: lastSixMonths }, ...matchQuery } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyPolicies = await Policy.aggregate([
      { $match: { createdAt: { $gte: lastSixMonths }, ...matchQuery } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      summary: {
        totalMeetings,
        completedMeetings,
        totalPolicies,
        updatedPolicies,
      },
      trends: { monthlyMeetings, monthlyPolicies },
    });
  } catch (error) {
    console.error("❌ Analytics Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to load analytics" });
  }
};

/**
 * Retreives an organization-wide paginated chronological list of meetings with filters.
 */
export const getOrgTimeline = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const skip = (page - 1) * limit;

    const match = {
      organization: req.user.organization,
      deletedAt: null,
    };

    if (
      req.query.teamId &&
      req.query.teamId !== req.user.organization.toString()
    ) {
      if (mongoose.isValidObjectId(req.query.teamId)) {
        const analytics = await MeetingAnalytics.find(
          {
            organization: req.user.organization,
            teamId: new mongoose.Types.ObjectId(req.query.teamId),
          },
          "meeting",
        ).lean();
        const meetingIds = analytics.map((a) => a.meeting);
        match._id = { $in: meetingIds };
      } else {
        const analytics = await MeetingAnalytics.find(
          {
            organization: req.user.organization,
            teamId: req.query.teamId,
          },
          "meeting",
        ).lean();
        const meetingIds = analytics.map((a) => a.meeting);
        match._id = { $in: meetingIds };
      }
    }

    if (req.query.tag) {
      match.tags = req.query.tag;
    }

    if (req.query.seriesId) {
      if (mongoose.isValidObjectId(req.query.seriesId)) {
        match.series = new mongoose.Types.ObjectId(req.query.seriesId);
      }
    }

    const totalCount = await Meeting.countDocuments(match);
    const meetings = await Meeting.find(match)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate("series", "title")
      .lean();

    const data = await Promise.all(
      meetings.map(async (m) => {
        const [decisionsCount, actionItemsCount] = await Promise.all([
          Decision.countDocuments({ sourceMeetingId: m._id }),
          ActionItem.countDocuments({ sourceMeetingId: m._id }),
        ]);

        let teamName = m.meetingType
          ? m.meetingType.charAt(0).toUpperCase() + m.meetingType.slice(1)
          : "Internal";

        const analyticsDoc = await MeetingAnalytics.findOne({
          meeting: m._id,
        }).lean();
        if (analyticsDoc && analyticsDoc.teamId) {
          const teamIdStr = analyticsDoc.teamId.toString();
          if (teamIdStr === "team-eng") {
            teamName = "Engineering Core";
          } else if (teamIdStr === "team-prod") {
            teamName = "Product Management";
          } else if (mongoose.isValidObjectId(teamIdStr)) {
            teamName = `Team ${teamIdStr.substring(0, 6)}`;
          } else {
            teamName = teamIdStr;
          }
        }

        return {
          id: m._id,
          title: m.title,
          date: m.date ? new Date(m.date).toISOString().split("T")[0] : null,
          time: m.time || "",
          teamName,
          seriesName: m.series?.title || null,
          tags: m.tags || [],
          counts: {
            decisions: decisionsCount,
            actionItems: actionItemsCount,
            attendees: m.participants?.length || 0,
          },
        };
      }),
    );

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("❌ Org Timeline Controller Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error compiling structural timeline metrics.",
    });
  }
};
