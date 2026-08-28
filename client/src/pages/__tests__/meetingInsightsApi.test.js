import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  mapActionStats,
  mapAttendanceTrend,
  mapEngagementMembers,
  buildInsightsFromMetrics,
  fetchMeetingInsightsDashboard,
} from "../meetingInsightsApi.js";
import { InsightCategory } from "../meetingInsightsTypes.js";

vi.mock("../../services/attendanceApi.js", () => ({
  getAttendanceStats: vi.fn(),
  getAttendanceTrends: vi.fn(),
  getMeetingTypeBreakdown: vi.fn(),
}));

vi.mock("../../services/actionItemAnalyticsApi.js", () => ({
  actionItemAnalyticsApi: {
    getCompletionMetrics: vi.fn(),
    getPriorityBreakdowns: vi.fn(),
    getOverdueTrends: vi.fn(),
    getMeetingEffectiveness: vi.fn(),
  },
}));

vi.mock("../../services/meetingCostApi.js", () => ({
  getOrgCostAnalytics: vi.fn(),
}));

vi.mock("../../services/sentimentTimelineApi.js", () => ({
  default: {
    getOrgTrends: vi.fn(),
  },
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
  },
}));

import {
  getAttendanceStats,
  getAttendanceTrends,
  getMeetingTypeBreakdown,
} from "../../services/attendanceApi.js";
import { actionItemAnalyticsApi } from "../../services/actionItemAnalyticsApi.js";
import { getOrgCostAnalytics } from "../../services/meetingCostApi.js";
import sentimentTimelineApi from "../../services/sentimentTimelineApi.js";
import apiClient from "../../services/apiClient.js";

describe("meetingInsightsApi (#2439)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps attendance trends from API rows", () => {
    const mapped = mapAttendanceTrend(
      [
        {
          dateLabel: "2026-W01",
          meetings: 4,
          avgParticipants: 6,
        },
      ],
      [{ attendanceRate: 80 }],
    );

    expect(mapped[0].week).toBe("2026-W01");
    expect(mapped[0].totalMeetings).toBe(4);
    expect(mapped[0].avgParticipants).toBe(6);
  });

  it("maps action item stats and priority breakdown", () => {
    const stats = mapActionStats(
      { total: 10, completed: 7, overdue: 1, completionRate: 70 },
      [{ priority: "high", count: 3, completed: 2 }],
    );

    expect(stats.total).toBe(10);
    expect(stats.byPriority.high).toEqual({ total: 3, completed: 2 });
  });

  it("builds insights from live metric summaries", () => {
    const insights = buildInsightsFromMetrics({
      stats: {
        avgAttendance: 82,
        activeMembers: 5,
        totalMeetings: 12,
        totalHours: 20,
      },
      actionStats: {
        total: 8,
        completed: 6,
        overdue: 1,
        completionRate: 75,
      },
      sentimentSummary: {
        averageScore: 0.4,
        positivePercent: 60,
        negativePercent: 10,
        trendDirection: "improving",
      },
      costAnalytics: { totalCost: 5000, currency: "USD" },
    });

    expect(
      insights.some((item) => item.category === InsightCategory.ATTENDANCE),
    ).toBe(true);
    expect(
      insights.some((item) => item.category === InsightCategory.ACTION_ITEMS),
    ).toBe(true);
  });

  it("fetchMeetingInsightsDashboard calls analytics APIs", async () => {
    getAttendanceStats.mockResolvedValue({
      stats: [{ name: "Ada", attendanceRate: 90, attended: 9 }],
      totalMeetings: 10,
    });
    getAttendanceTrends.mockResolvedValue([
      { dateLabel: "2026-W01", meetings: 2, avgParticipants: 5 },
    ]);
    getMeetingTypeBreakdown.mockResolvedValue([{ name: "Standup", value: 4 }]);
    actionItemAnalyticsApi.getCompletionMetrics.mockResolvedValue({
      total: 5,
      completed: 4,
      overdue: 0,
      completionRate: 80,
    });
    actionItemAnalyticsApi.getPriorityBreakdowns.mockResolvedValue([]);
    actionItemAnalyticsApi.getOverdueTrends.mockResolvedValue([]);
    actionItemAnalyticsApi.getMeetingEffectiveness.mockResolvedValue([]);
    getOrgCostAnalytics.mockResolvedValue({
      success: true,
      data: { totalCost: 1000, totalTimeHours: 12, costByMonth: [] },
    });
    apiClient.get.mockResolvedValue({
      data: { success: true, data: { rankings: [] } },
    });
    sentimentTimelineApi.getOrgTrends.mockResolvedValue({
      data: { success: true, data: { summary: {}, timeline: [] } },
    });

    const result = await fetchMeetingInsightsDashboard({
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      organizationId: "org-1",
    });

    expect(getAttendanceStats).toHaveBeenCalled();
    expect(actionItemAnalyticsApi.getCompletionMetrics).toHaveBeenCalled();
    expect(getOrgCostAnalytics).toHaveBeenCalled();
    expect(result.stats.totalMeetings).toBe(10);
    expect(result.meetingTypes[0].type).toBe("Standup");
  });

  it("maps engagement rankings to member cards", () => {
    const members = mapEngagementMembers([
      {
        _id: "score-1",
        overallScore: 88,
        userId: { _id: "u1", name: "Ada Lovelace" },
        metrics: { meetingsAttended: 6, actionItemsCompleted: 3 },
        dimensionalScores: { speaking: 42 },
      },
    ]);

    expect(members[0].name).toBe("Ada Lovelace");
    expect(members[0].engagementScore).toBe(88);
    expect(members[0].avatar).toBe("AL");
  });
});
