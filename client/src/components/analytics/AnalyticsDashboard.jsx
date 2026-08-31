import React, { useEffect, useState, useCallback } from "react";
import apiClient from "../../services/apiClient";
import MeetingAnalyticsDetail from "./MeetingAnalyticsDetail";

/**
 * @desc Main analytics dashboard showing team-level summaries and a list
 * of recent meetings with their engagement/efficiency scores.
 */
const AnalyticsDashboard = ({ teamId }) => {
  const [summary, setSummary] = useState(null);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: summaryData } = await apiClient.get(
        `/api/analytics/team/${teamId}/summary`,
      );
      setSummary(summaryData.data);

      const { data: meetingsData } = await apiClient.get(
        `/api/analytics/team/${teamId}/recent?limit=10`,
      );
      setRecentMeetings(meetingsData.data.meetings || []);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to fetch analytics",
      );
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"
          ></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl flex flex-col items-center justify-center">
        <p className="font-semibold text-lg">Error Loading Analytics</p>
        <p className="text-sm mt-1 text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Avg. Engagement"
          value={summary?.avgEngagement ? Math.round(summary.avgEngagement) : 0}
          suffix="/100"
          color="text-indigo-600 dark:text-indigo-400"
          icon="chart-bar"
        />
        <StatCard
          title="Avg. Efficiency"
          value={summary?.avgEfficiency ? Math.round(summary.avgEfficiency) : 0}
          suffix="/100"
          color="text-green-600 dark:text-green-400"
          icon="lightning-bolt"
        />
        <StatCard
          title="Total Meetings"
          value={summary?.totalMeetings || 0}
          color="text-blue-600 dark:text-blue-400"
          icon="calendar"
        />
        <StatCard
          title="Avg. Duration"
          value={summary?.avgDuration ? Math.round(summary.avgDuration) : 0}
          suffix="min"
          color="text-purple-600 dark:text-purple-400"
          icon="clock"
        />
      </div>

      {/* Recent Meetings List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Recent Meeting Performance
          </h2>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {recentMeetings.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No meetings analyzed yet.
            </div>
          ) : (
            recentMeetings.map((meeting) => (
              <button
                key={meeting._id}
                onClick={() => setSelectedMeetingId(meeting._id)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {meeting.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(meeting.date).toLocaleDateString()} •{" "}
                    {meeting.duration} min
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Engagement
                    </p>
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">
                      {meeting.analytics?.engagementScore || "--"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Efficiency
                    </p>
                    <p className="font-bold text-green-600 dark:text-green-400">
                      {meeting.analytics?.efficiencyScore || "--"}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedMeetingId && (
        <MeetingAnalyticsDetail
          meetingId={selectedMeetingId}
          onClose={() => setSelectedMeetingId(null)}
        />
      )}
    </div>
  );
};

// Helper component for stat cards
const StatCard = ({ title, value, suffix, color }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <div
        className={`w-10 h-10 rounded-lg bg-opacity-10 flex items-center justify-center ${color.replace("text-", "bg-")}`}
      >
        {/* Icon placeholder */}
        <div className={`w-5 h-5 ${color}`}></div>
      </div>
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`text-3xl font-black ${color}`}>{value}</span>
      {suffix && (
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

export default AnalyticsDashboard;
