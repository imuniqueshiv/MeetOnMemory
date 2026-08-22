import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent.js";
import apiClient from "../services/apiClient.js";
import {
  TrendingUp,
  Smile,
  Frown,
  Meh,
  Calendar,
  ExternalLink,
  Loader2,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const OrganizationSentimentTrends = () => {
  const { userData } = useContext(AppContent) || {};
  const navigate = useNavigate();
  const orgId = userData?.organization?._id || userData?.organization;

  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalMeetings: 0,
    analyzedMeetings: 0,
    overallAverageScore: 0,
    trends: [],
  });

  const fetchTrends = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `/api/sentiment-timeline/organization/${orgId}/trends?range=${range}`,
      );
      if (res.data?.success && res.data?.data) {
        setStats(res.data.data);
      } else {
        setError(res.data?.message || "Failed to load sentiment trends");
      }
    } catch (err) {
      console.error("Error loading sentiment trends:", err);
      setError(
        "Failed to load organization sentiment trends. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [orgId, range]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const chartData = (stats.trends || [])
    .filter((t) => t.hasSentiment)
    .map((t) => ({
      name: t.title?.length > 20 ? `${t.title.slice(0, 20)}...` : t.title,
      score: t.averageScore,
      date: t.date ? new Date(t.date).toLocaleDateString() : "",
      meetingId: t.meetingId,
    }));

  const getSentimentBadge = (score) => {
    if (score === null || score === undefined) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          Unanalyzed
        </span>
      );
    }
    if (score >= 0.6) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
          <Smile className="w-3.5 h-3.5" />
          Positive ({(score * 100).toFixed(0)}%)
        </span>
      );
    }
    if (score >= 0.4) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
          <Meh className="w-3.5 h-3.5" />
          Neutral ({(score * 100).toFixed(0)}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
        <Frown className="w-3.5 h-3.5" />
        Needs Attention ({(score * 100).toFixed(0)}%)
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200">
      <Navbar />

      <div className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
        <div
          role="region"
          aria-label="Organization Sentiment Header"
          className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-slate-200 dark:border-slate-800"
        >
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Organization Sentiment Trends
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Track overall mood, tone, and meeting engagement trajectories
              across your organization over time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              aria-label="Time Range Filter"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">Past Year</option>
            </select>
            <button
              onClick={fetchTrends}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              aria-label="Refresh Sentiment Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-400">
              Overall Sentiment Score
            </span>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {(stats.overallAverageScore * 100).toFixed(0)}%
              </p>
              {getSentimentBadge(stats.overallAverageScore)}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-400">
              Analyzed Meetings
            </span>
            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
              {stats.analyzedMeetings} / {stats.totalMeetings}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <span className="text-xs font-bold uppercase text-slate-400">
              Sentiment Coverage
            </span>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              {stats.totalMeetings
                ? `${((stats.analyzedMeetings / stats.totalMeetings) * 100).toFixed(0)}%`
                : "100%"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
            Aggregating organization sentiment trends...
          </div>
        ) : error ? (
          <div
            data-testid="sentiment-error-card"
            className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-800 max-w-md mx-auto space-y-4"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={fetchTrends}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Trend Chart */}
            <div
              role="region"
              aria-label="Sentiment Trajectory Chart"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Sentiment Trajectory Over Range
              </h2>
              {chartData.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="sentimentGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#6366f1"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="#6366f1"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 1]} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#6366f1"
                        fillOpacity={1}
                        fill="url(#sentimentGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">
                  No meeting sentiment timelines found for this timeframe.
                </div>
              )}
            </div>

            {/* Meetings Breakdown Drill-down Table */}
            <div
              role="region"
              aria-label="Meeting Sentiment Breakdown"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Meeting Sentiment Breakdown ({stats.trends?.length || 0})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                      <th className="pb-3">Meeting</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Sentiment Score</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(stats.trends || []).map((m) => (
                      <tr key={m.meetingId}>
                        <td className="py-3 font-semibold text-slate-900 dark:text-white">
                          {m.title || "Untitled Meeting"}
                        </td>
                        <td className="py-3 text-slate-500 dark:text-slate-400 text-xs">
                          {m.date ? new Date(m.date).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3">
                          {getSentimentBadge(m.averageScore)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => navigate(`/meetings/${m.meetingId}`)}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                          >
                            <span>Details</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationSentimentTrends;
