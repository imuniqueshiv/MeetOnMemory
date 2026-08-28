import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Brain,
  Filter,
  RotateCcw,
  Users,
  Clock,
  CheckCircle,
  DollarSign,
  BarChart3,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { CATEGORY_CONFIG } from "./meetingInsightsTypes";
import {
  fetchMeetingInsightsDashboard,
  defaultInsightsDateRange,
} from "./meetingInsightsApi";
import {
  MetricCard,
  InsightCard,
  MemberCard,
  ActionItemStatCard,
} from "./MeetingInsightCards";
import {
  AttendanceTrendChart,
  MeetingTypeBreakdownChart,
  SentimentTimelineChart,
  WeeklyMetricsChart,
  EngagementRadarChart,
  EfficiencyBarChart,
  ActionItemsDonutChart,
  CostTrendChart,
} from "./MeetingInsightCharts";
import ErrorState from "../components/ErrorState";
import AppContent from "../context/AppContent";

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "insights", label: "AI Insights", icon: Brain },
  { key: "engagement", label: "Engagement", icon: Users },
  { key: "actions", label: "Action Items", icon: CheckCircle },
  { key: "cost", label: "Cost & Efficiency", icon: DollarSign },
];

const hasDashboardData = (payload) =>
  Boolean(
    payload &&
    (payload.stats?.totalMeetings > 0 ||
      payload.insights?.length > 0 ||
      payload.attendanceTrend?.length > 0 ||
      payload.engagementData?.length > 0),
  );

const MeetingInsightsDashboard = () => {
  const { userData } = useContext(AppContent) || {};
  const organizationId =
    (typeof userData?.organization === "object"
      ? userData?.organization?._id
      : userData?.organization) || "";

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateRange, setDateRange] = useState(defaultInsightsDateRange);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMeetingInsightsDashboard({
        ...dateRange,
        organizationId,
      });
      setPayload(data);
    } catch (err) {
      console.error("Failed to load meeting insights:", err);
      setError("Unable to load meeting insights. Please try again.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange, organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredInsights = useMemo(() => {
    const insights = payload?.insights || [];
    if (selectedCategory === "all") return insights;
    return insights.filter((insight) => insight.category === selectedCategory);
  }, [payload, selectedCategory]);

  const resetFilters = () => {
    setSelectedCategory("all");
    setDateRange(defaultInsightsDateRange());
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 text-slate-600 dark:text-gray-300">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span>Loading meeting insights...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 pt-28 px-4">
        <div className="max-w-lg mx-auto">
          <ErrorState
            title="Unable to load insights"
            message={error}
            onRetry={loadData}
          />
        </div>
      </div>
    );
  }

  if (!hasDashboardData(payload)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 pt-28 px-4">
        <div className="max-w-2xl mx-auto rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center">
          <Brain
            className="h-10 w-10 mx-auto text-violet-500 mb-4"
            aria-hidden="true"
          />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Meeting Insights
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            No meeting insights are available for this period yet. Complete
            meetings and capture attendance, action items, or sentiment data to
            populate this dashboard.
          </p>
        </div>
      </div>
    );
  }

  const {
    stats,
    attendanceTrend,
    engagementData,
    meetingTypes,
    weeklyMetrics,
    sentimentTimeline,
    actionStats,
    efficiencyData,
  } = payload;

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
        <section className="mb-6 sm:mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="h-1 bg-linear-to-r from-blue-600 via-violet-600 to-indigo-600" />
            <div className="px-5 py-7 sm:px-8 sm:py-9">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
                    <Brain className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                      Meeting Insights
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                      Organization analytics from attendance, engagement, cost,
                      and action item APIs
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-gray-400">
                    From
                    <input
                      type="date"
                      value={dateRange.startDate}
                      max={dateRange.endDate}
                      onChange={(e) =>
                        setDateRange((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                      className="ml-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-500 dark:text-gray-400">
                    To
                    <input
                      type="date"
                      value={dateRange.endDate}
                      min={dateRange.startDate}
                      onChange={(e) =>
                        setDateRange((prev) => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                      className="ml-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 sm:mb-8">
          <MetricCard
            icon={BarChart3}
            label="Total Meetings"
            value={stats.totalMeetings}
            subtitle="in selected period"
            color="#22c55e"
          />
          <MetricCard
            icon={Clock}
            label="Total Hours"
            value={`${stats.totalHours.toFixed(0)}h`}
            subtitle="participant time"
            color="#0ea5e9"
          />
          <MetricCard
            icon={CheckCircle}
            label="Action Items"
            value={stats.totalActionItems}
            subtitle="tracked"
            color="#8b5cf6"
          />
          <MetricCard
            icon={Users}
            label="Avg Attendance"
            value={`${stats.avgAttendance.toFixed(0)}%`}
            subtitle={`${stats.activeMembers} active members`}
            color="#f59e0b"
          />
          <MetricCard
            icon={TrendingUp}
            label="Completion"
            value={`${stats.efficiencyScore}/100`}
            subtitle="action item rate"
            color="#14b8a6"
          />
          <MetricCard
            icon={DollarSign}
            label="Total Cost"
            value={`$${(stats.totalCost / 1000).toFixed(1)}k`}
            subtitle="meeting investment"
            color="#6366f1"
          />
        </section>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-gray-800 rounded-xl mb-6 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {attendanceTrend.length > 0 ? (
                <AttendanceTrendChart data={attendanceTrend} />
              ) : null}
              {weeklyMetrics.length > 0 ? (
                <WeeklyMetricsChart data={weeklyMetrics} />
              ) : null}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sentimentTimeline.length > 0 ? (
                <SentimentTimelineChart data={sentimentTimeline} />
              ) : null}
              {meetingTypes.length > 0 ? (
                <MeetingTypeBreakdownChart data={meetingTypes} />
              ) : null}
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">
                  Filter:
                </span>
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={resetFilters}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              </button>
              <span className="ml-auto text-[11px] text-slate-400">
                {filteredInsights.length} insights
              </span>
            </div>

            {filteredInsights.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-gray-400 text-center py-8">
                No insights match this filter for the selected period.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredInsights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "engagement" && (
          <div className="space-y-6">
            {engagementData.length > 0 ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <EngagementRadarChart data={engagementData} />
                  {efficiencyData.length > 0 ? (
                    <EfficiencyBarChart data={efficiencyData} />
                  ) : null}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100 mb-3">
                    Team Members
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {engagementData.map((member) => (
                      <MemberCard key={member.id} member={member} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-gray-400 text-center py-8">
                No engagement rankings available yet.
              </p>
            )}
          </div>
        )}

        {activeTab === "actions" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <ActionItemStatCard stats={actionStats} />
            </div>
            <div className="lg:col-span-2">
              {actionStats.total > 0 ? (
                <>
                  <ActionItemsDonutChart stats={actionStats} />
                  <div className="mt-4 rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100 mb-3">
                      Priority Breakdown
                    </h3>
                    {Object.entries(actionStats.byPriority).map(
                      ([priority, data]) => {
                        const rate =
                          data.total > 0
                            ? Math.round((data.completed / data.total) * 100)
                            : 0;
                        const color =
                          priority === "high" || priority === "urgent"
                            ? "#ef4444"
                            : priority === "medium"
                              ? "#f59e0b"
                              : "#22c55e";
                        return (
                          <div key={priority} className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold capitalize text-slate-700 dark:text-gray-300">
                                {priority}
                              </span>
                              <span className="text-slate-500">
                                {data.completed}/{data.total} ({rate}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${rate}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500 dark:text-gray-400 text-center py-8">
                  No action item analytics for this period.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "cost" && (
          <div className="space-y-6">
            {weeklyMetrics.length > 0 ? (
              <CostTrendChart data={weeklyMetrics} />
            ) : null}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {efficiencyData.length > 0 ? (
                <EfficiencyBarChart data={efficiencyData} />
              ) : null}
              {meetingTypes.length > 0 ? (
                <MeetingTypeBreakdownChart data={meetingTypes} />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingInsightsDashboard;
