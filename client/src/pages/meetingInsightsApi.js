import { format, subDays } from "date-fns";
import apiClient from "../services/apiClient.js";
import {
  getAttendanceStats,
  getAttendanceTrends,
  getMeetingTypeBreakdown,
} from "../services/attendanceApi.js";
import { actionItemAnalyticsApi } from "../services/actionItemAnalyticsApi.js";
import { getOrgCostAnalytics } from "../services/meetingCostApi.js";
import sentimentTimelineApi from "../services/sentimentTimelineApi.js";
import {
  InsightCategory,
  InsightSeverity,
  TrendDirection,
} from "./meetingInsightsTypes.js";

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

export const defaultInsightsDateRange = () => ({
  startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
  endDate: format(new Date(), "yyyy-MM-dd"),
});

export const mapAttendanceTrend = (trends = [], memberStats = []) => {
  const maxParticipants = Math.max(
    ...trends.map((row) => row.avgParticipants || 0),
    1,
  );
  const avgOrgRate =
    memberStats.length > 0
      ? memberStats.reduce((sum, row) => sum + (row.attendanceRate || 0), 0) /
        memberStats.length
      : 0;

  return trends.map((row) => ({
    week: row.dateLabel || row.date || "—",
    date: row.dateLabel || row.date || "",
    rate:
      row.avgParticipants > 0
        ? Math.min(
            100,
            Math.round((row.avgParticipants / maxParticipants) * avgOrgRate) ||
              Math.round(avgOrgRate),
          )
        : Math.round(avgOrgRate),
    totalMeetings: row.meetings || 0,
    avgParticipants: Math.round((row.avgParticipants || 0) * 10) / 10,
  }));
};

export const mapMeetingTypes = (typeBreakdown = []) =>
  typeBreakdown.map((row) => ({
    type: row.name || row.type || "Other",
    count: row.value || row.count || 0,
    avgDuration: row.avgDuration || 0,
    avgAttendance: row.avgAttendance || 0,
    avgSatisfaction: row.avgSatisfaction || 0,
    totalCost: row.totalCost || 0,
  }));

export const mapWeeklyMetrics = (
  trends = [],
  costAnalytics = {},
  overdueTrends = [],
) => {
  const costByMonth = costAnalytics?.costByMonth || [];
  const avgMonthlyCost =
    costByMonth.length > 0
      ? costByMonth.reduce((sum, row) => sum + (row.cost || 0), 0) /
        costByMonth.length
      : 0;

  return trends.map((row, index) => {
    const overdue = overdueTrends[index] || {};
    return {
      week: row.dateLabel || row.date || `W${index + 1}`,
      meetingsHeld: row.meetings || 0,
      totalHours:
        Math.round(
          ((costAnalytics?.totalTimeHours || 0) / Math.max(trends.length, 1)) *
            10,
        ) / 10,
      decisionsMade: 0,
      actionItemsCreated: overdue.newItems || 0,
      actionItemsCompleted: overdue.resolvedItems || 0,
      avgSentiment: 0,
      costUsd: Math.round(avgMonthlyCost / Math.max(trends.length, 1)),
    };
  });
};

export const mapSentimentTimeline = (sentimentData) => {
  const timeline = sentimentData?.timeline || [];
  return timeline.map((entry) => {
    const total =
      (entry.positiveCount || 0) +
      (entry.neutralCount || 0) +
      (entry.negativeCount || 0);
    const toPercent = (count) =>
      total > 0 ? Math.round((count / total) * 100) : 0;
    const dateValue = entry.date
      ? format(new Date(entry.date), "yyyy-MM-dd")
      : "—";

    return {
      date: dateValue,
      positive: toPercent(entry.positiveCount),
      neutral: toPercent(entry.neutralCount),
      negative: toPercent(entry.negativeCount),
      score: entry.averageScore || 0,
    };
  });
};

export const mapActionStats = (
  completionMetrics = {},
  priorityBreakdowns = [],
) => {
  const byPriority = {};
  for (const row of priorityBreakdowns) {
    const key = row.priority || "medium";
    byPriority[key] = {
      total: row.count || 0,
      completed: row.completed || 0,
    };
  }

  const total = completionMetrics.total || 0;
  const completed = completionMetrics.completed || 0;
  const overdue = completionMetrics.overdue || 0;

  return {
    total,
    completed,
    inProgress: Math.max(total - completed - overdue, 0),
    overdue,
    avgCompletionDays:
      Math.round(
        ((completionMetrics.avgTimeToCompletionMs || 0) / 86400000) * 10,
      ) / 10,
    completionRate: Math.round(completionMetrics.completionRate || 0),
    byPriority,
  };
};

export const mapEngagementMembers = (rankings = []) =>
  rankings.map((entry) => {
    const user = entry.userId || {};
    const name = user.name || user.email || "Team member";
    return {
      id: user._id || entry._id,
      name,
      role: "Team member",
      avatar: initials(name),
      engagementScore: Math.round(entry.overallScore || 0),
      meetingsAttended: entry.metrics?.meetingsAttended || 0,
      speakingTimePercent: Math.round(entry.dimensionalScores?.speaking || 0),
      actionItemsCompleted: entry.metrics?.actionItemsCompleted || 0,
      avgSentiment: 0,
    };
  });

export const mapEfficiencyData = (meetingEffectiveness = []) =>
  meetingEffectiveness.slice(0, 8).map((row) => ({
    type: row.meetingTitle || "Meeting",
    efficiency: Math.round(row.completionRate || 0),
    onTimeStart: 0,
    agendaAdherence: 0,
    followUpRate: Math.round(row.completionRate || 0),
    avgRating: 0,
  }));

export const mapSummaryStats = ({
  totalMeetings = 0,
  memberStats = [],
  costAnalytics = {},
  actionStats = {},
  sentimentSummary = {},
}) => {
  const avgAttendance =
    memberStats.length > 0
      ? memberStats.reduce((sum, row) => sum + (row.attendanceRate || 0), 0) /
        memberStats.length
      : 0;

  return {
    totalMeetings,
    totalHours: Math.round((costAnalytics.totalTimeHours || 0) * 10) / 10,
    totalDecisions: 0,
    totalActionItems: actionStats.total || 0,
    avgAttendance: Math.round(avgAttendance * 10) / 10,
    avgSentiment: sentimentSummary.averageScore || 0,
    totalCost: Math.round(costAnalytics.totalCost || 0),
    activeMembers: memberStats.length,
    meetingGrowthPercent: 0,
    efficiencyScore: Math.round(actionStats.completionRate || 0),
  };
};

export const buildInsightsFromMetrics = ({
  stats,
  actionStats,
  sentimentSummary,
  costAnalytics,
}) => {
  const insights = [];
  const now = new Date().toISOString();

  if (stats.avgAttendance > 0) {
    insights.push({
      id: "attendance-summary",
      category: InsightCategory.ATTENDANCE,
      title: `Average attendance ${stats.avgAttendance.toFixed(0)}%`,
      description: `${stats.activeMembers} active members participated across ${stats.totalMeetings} meetings in this period.`,
      severity:
        stats.avgAttendance >= 75
          ? InsightSeverity.POSITIVE
          : InsightSeverity.WARNING,
      value: stats.avgAttendance,
      unit: "%",
      trend: TrendDirection.STABLE,
      changePercent: 0,
      createdAt: now,
      updatedAt: now,
      source: "Attendance Analytics",
      confidence: 0.9,
      actionable: stats.avgAttendance < 75,
      recommendedActions: ["Review recurring meetings with low attendance"],
    });
  }

  if (actionStats.total > 0) {
    insights.push({
      id: "action-items-summary",
      category: InsightCategory.ACTION_ITEMS,
      title: `${actionStats.overdue} overdue action items`,
      description: `Completion rate is ${actionStats.completionRate}% with ${actionStats.completed} of ${actionStats.total} items closed.`,
      severity:
        actionStats.overdue > 0
          ? InsightSeverity.WARNING
          : InsightSeverity.POSITIVE,
      value: actionStats.completionRate,
      unit: "%",
      trend:
        actionStats.completionRate >= 70
          ? TrendDirection.IMPROVING
          : TrendDirection.DECLINING,
      changePercent: 0,
      createdAt: now,
      updatedAt: now,
      source: "Action Item Analytics",
      confidence: 0.88,
      actionable: actionStats.overdue > 0,
      recommendedActions: ["Assign owners and due dates for overdue items"],
    });
  }

  if (sentimentSummary?.averageScore) {
    insights.push({
      id: "sentiment-summary",
      category: InsightCategory.SENTIMENT,
      title: `Sentiment score ${sentimentSummary.averageScore.toFixed(1)}`,
      description: `${sentimentSummary.positivePercent || 0}% positive, ${sentimentSummary.negativePercent || 0}% negative across analyzed meetings.`,
      severity:
        sentimentSummary.averageScore >= 0.2
          ? InsightSeverity.POSITIVE
          : InsightSeverity.NEUTRAL,
      value: sentimentSummary.averageScore,
      unit: "score",
      trend:
        sentimentSummary.trendDirection === "improving"
          ? TrendDirection.IMPROVING
          : sentimentSummary.trendDirection === "declining"
            ? TrendDirection.DECLINING
            : TrendDirection.STABLE,
      changePercent: 0,
      createdAt: now,
      updatedAt: now,
      source: "Sentiment Timeline",
      confidence: 0.85,
      actionable: false,
      recommendedActions: [],
    });
  }

  if (costAnalytics?.totalCost > 0) {
    insights.push({
      id: "cost-summary",
      category: InsightCategory.COST,
      title: `Meeting cost ${costAnalytics.currency || "USD"} ${Math.round(costAnalytics.totalCost).toLocaleString()}`,
      description: `${stats.totalHours.toFixed(0)} participant-hours recorded in completed meetings.`,
      severity: InsightSeverity.NEUTRAL,
      value: Math.round(costAnalytics.totalCost),
      unit: costAnalytics.currency || "USD",
      trend: TrendDirection.STABLE,
      changePercent: 0,
      createdAt: now,
      updatedAt: now,
      source: "Meeting Cost Analytics",
      confidence: 0.9,
      actionable: true,
      recommendedActions: ["Review high-cost recurring meetings"],
    });
  }

  return insights;
};

export const fetchMeetingInsightsDashboard = async ({
  startDate,
  endDate,
  organizationId,
}) => {
  const params = { startDate, endDate };

  const [
    attendanceStatsRes,
    attendanceTrendsRes,
    typeBreakdownRes,
    completionMetrics,
    priorityBreakdowns,
    overdueTrends,
    meetingEffectiveness,
    costRes,
    engagementRes,
    sentimentRes,
  ] = await Promise.all([
    getAttendanceStats(params),
    getAttendanceTrends({ ...params, granularity: "weekly" }),
    getMeetingTypeBreakdown(params),
    actionItemAnalyticsApi.getCompletionMetrics(startDate, endDate),
    actionItemAnalyticsApi.getPriorityBreakdowns(startDate, endDate),
    actionItemAnalyticsApi.getOverdueTrends(startDate, endDate),
    actionItemAnalyticsApi.getMeetingEffectiveness(startDate, endDate),
    getOrgCostAnalytics(params),
    apiClient.get("/api/engagement/organization/rankings", {
      params: { limit: 8 },
    }),
    organizationId
      ? sentimentTimelineApi.getOrgTrends(organizationId, { days: 30 })
      : Promise.resolve({ data: { success: true, data: null } }),
  ]);

  const memberStats = attendanceStatsRes?.stats || [];
  const costAnalytics = costRes?.success ? costRes.data : {};
  const sentimentData = sentimentRes?.data?.success
    ? sentimentRes.data.data
    : null;
  const engagementRankings =
    engagementRes?.data?.success && engagementRes.data.data?.rankings
      ? engagementRes.data.data.rankings
      : [];

  const actionStats = mapActionStats(completionMetrics, priorityBreakdowns);
  const stats = mapSummaryStats({
    totalMeetings: attendanceStatsRes?.totalMeetings || 0,
    memberStats,
    costAnalytics,
    actionStats,
    sentimentSummary: sentimentData?.summary || {},
  });

  return {
    stats,
    insights: buildInsightsFromMetrics({
      stats,
      actionStats,
      sentimentSummary: sentimentData?.summary || {},
      costAnalytics,
    }),
    attendanceTrend: mapAttendanceTrend(attendanceTrendsRes || [], memberStats),
    engagementData: mapEngagementMembers(engagementRankings),
    meetingTypes: mapMeetingTypes(typeBreakdownRes || []),
    weeklyMetrics: mapWeeklyMetrics(
      attendanceTrendsRes || [],
      costAnalytics,
      overdueTrends || [],
    ),
    sentimentTimeline: mapSentimentTimeline(sentimentData),
    actionStats,
    efficiencyData: mapEfficiencyData(meetingEffectiveness || []),
  };
};
