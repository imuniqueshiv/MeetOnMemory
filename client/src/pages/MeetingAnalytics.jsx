import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams } from "react-router-dom";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  Clock,
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Activity,
  Target,
  RefreshCw,
  Download,
} from "lucide-react";
import { toast } from "react-toastify";

const MeetingAnalytics = () => {
  const { meetingId } = useParams();
  const { backendUrl } = useContext(AppContent);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${backendUrl}/api/analytics/meetings/${meetingId}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        if (data.status === "not_analyzed") {
          setError("not_analyzed");
        } else {
          throw new Error(data.message || "Failed to fetch analytics");
        }
      } else {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError(err.message);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, meetingId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const triggerAnalysis = async () => {
    try {
      setAnalyzing(true);
      const response = await fetch(
        `${backendUrl}/api/analytics/analyze/${meetingId}`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to trigger analysis");
      }

      toast.info("Analysis started. This may take up to 60 seconds.");

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const checkResponse = await fetch(
            `${backendUrl}/api/analytics/meetings/${meetingId}`,
            { credentials: "include" },
          );

          if (checkResponse.ok) {
            const data = await checkResponse.json();
            if (data.status === "completed") {
              clearInterval(pollInterval);
              setAnalytics(data);
              setAnalyzing(false);
              toast.success("Analysis completed!");
            } else if (data.status === "failed") {
              clearInterval(pollInterval);
              setAnalyzing(false);
              toast.error("Analysis failed");
            }
          }
        } catch (err) {
          console.error("Error polling:", err);
        }
      }, 5000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setAnalyzing(false);
      }, 120000);
    } catch (err) {
      console.error("Error triggering analysis:", err);
      toast.error("Failed to start analysis");
      setAnalyzing(false);
    }
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              Loading analytics...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error === "not_analyzed") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 max-w-4xl mx-auto px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8 text-center">
            <Activity className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Analytics Not Available
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              This meeting hasn't been analyzed yet. Trigger analysis to
              generate comprehensive insights.
            </p>
            <button
              onClick={triggerAnalysis}
              disabled={analyzing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Activity className="w-5 h-5" />
                  Start Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 max-w-4xl mx-auto px-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">
              Error Loading Analytics
            </h2>
            <p className="text-red-700 dark:text-red-300 mb-4">
              {error || "Unknown error"}
            </p>
            <button
              onClick={fetchAnalytics}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { speakers, metrics, insights } = analytics;

  // Prepare chart data
  const speakerChartData = speakers.map((speaker) => ({
    name: speaker.name.split(" ")[0],
    time: Math.round(speaker.totalTime / 60),
    percentage: speaker.percentage.toFixed(1),
  }));

  const COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <div className="pt-20 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Meeting Analytics
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {analytics.meeting?.title || "Meeting"} •{" "}
                {new Date(analytics.meeting?.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={triggerAnalysis}
                disabled={analyzing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${analyzing ? "animate-spin" : ""}`}
                />
                {analyzing ? "Analyzing..." : "Re-analyze"}
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={Users}
            label="Participants"
            value={metrics.speakerCount}
            subtitle={`of ${metrics.participantCount} total`}
            color="blue"
          />
          <MetricCard
            icon={Clock}
            label="Duration"
            value={formatDuration(metrics.totalDuration)}
            subtitle={`${metrics.silencePeriods} silence periods`}
            color="purple"
          />
          <MetricCard
            icon={Activity}
            label="Engagement"
            value={`${metrics.engagementScore.toFixed(0)}%`}
            subtitle="Overall score"
            color="green"
          />
          <MetricCard
            icon={Award}
            label="Equity"
            value={`${metrics.participationEquity.toFixed(0)}%`}
            subtitle="Participation balance"
            color="orange"
          />
        </div>

        {/* Speaker Participation Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            Speaker Participation
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={speakerChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="time"
              >
                {speakerChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, props) => [
                  `${value} minutes (${props.payload.percentage}%)`,
                  props.payload.name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Speaker Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            Speaker Details
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Speaker
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Speaking Time
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Interventions
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Avg Length
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody>
                {speakers.map((speaker, idx) => (
                  <tr
                    key={speaker.userId}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: COLORS[idx % COLORS.length],
                          }}
                        />
                        <span className="font-medium text-slate-900 dark:text-white">
                          {speaker.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {formatDuration(speaker.totalTime)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {speaker.interventionCount}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {formatDuration(speaker.averageInterventionLength)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${speaker.percentage}%`,
                              backgroundColor: COLORS[idx % COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400 w-12">
                          {speaker.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" />
            AI-Powered Insights
          </h2>
          <div className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400 text-center py-8">
                No insights available
              </p>
            ) : (
              insights.map((insight, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    insight.type === "strength"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-500"
                      : insight.type === "weakness"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-500"
                        : insight.type === "recommendation"
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-500"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {insight.type === "strength" ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    ) : insight.type === "weakness" ? (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-slate-900 dark:text-white font-medium mb-1">
                        {insight.message}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="capitalize">{insight.category}</span>
                        <span>•</span>
                        <span className="capitalize">
                          {insight.impact} impact
                        </span>
                        {insight.actionable && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-400">
                              Actionable
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Meeting Metrics Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            Meeting Metrics Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricDetail
              label="Total Silence Time"
              value={formatDuration(metrics.totalSilenceTime)}
              icon={Clock}
            />
            <MetricDetail
              label="Avg Intervention Length"
              value={formatDuration(metrics.averageInterventionLength)}
              icon={Activity}
            />
            <MetricDetail
              label="Longest Intervention"
              value={formatDuration(metrics.longestIntervention)}
              icon={TrendingUp}
            />
            <MetricDetail
              label="Decision Density"
              value={`${metrics.decisionDensity.toFixed(1)}/hour`}
              icon={Target}
            />
            <MetricDetail
              label="Action Item Density"
              value={`${metrics.actionItemDensity.toFixed(1)}/hour`}
              icon={Target}
            />
            <MetricDetail
              label="Silence Periods"
              value={metrics.silencePeriods}
              icon={Clock}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, label, value, subtitle, color }) => {
  // Assign to capitalized local variable to satisfy JSX component naming
  // and avoid ESLint no-unused-vars false positives on destructuring renames
  const Icon = icon;

  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    purple:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    green:
      "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    orange:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between mb-2">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      )}
    </div>
  );
};

const MetricDetail = ({ label, value, icon }) => {
  // Assign to capitalized local variable to satisfy JSX component naming
  // and avoid ESLint no-unused-vars false positives on destructuring renames
  const Icon = icon;

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <Icon className="w-5 h-5 text-slate-400" />
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
};

export default MeetingAnalytics;
