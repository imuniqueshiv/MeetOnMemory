import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../../services/apiClient.js";
import {
  Mic,
  Clock,
  Layers,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  RefreshCw,
  Search,
  Activity,
  AlertCircle,
  Filter,
  Check,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";

const RecordingSessionAnalyticsPanel = ({ meetingId = null }) => {
  const [metricsData, setMetricsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [resolvingId, setResolvingId] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (meetingId) params.meetingId = meetingId;
      const { data } = await apiClient.get("/api/recording-sessions/metrics", {
        params,
      });
      if (data.success) {
        setMetricsData(data);
      } else {
        throw new Error(data.message || "Failed to fetch session metrics");
      }
    } catch (err) {
      console.error("Error fetching recording session analytics:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load recording session analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleResolveStuck = async (sessionId, targetStatus, reason) => {
    try {
      setResolvingId(sessionId);
      const { data } = await apiClient.patch(
        `/api/recording-sessions/${sessionId}/resolve-stuck`,
        {
          targetStatus,
          reason:
            reason || `Stuck recording manually resolved to ${targetStatus}`,
        },
      );
      if (data.success) {
        toast.success(`Session marked as ${targetStatus}`);
        fetchMetrics();
      }
    } catch (err) {
      console.error("Error resolving stuck session:", err);
      toast.error("Failed to update session status");
    } finally {
      setResolvingId(null);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return "0s";
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

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const diffSec = Math.floor((new Date() - date) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading && !metricsData) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
          Loading recording session analytics...
        </p>
      </div>
    );
  }

  if (error && !metricsData) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-red-900 dark:text-red-200 mb-1">
          Analytics Unavailable
        </h3>
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-xl transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    metrics,
    stuckSessions = [],
    recentSessions = [],
  } = metricsData || {};

  // Filter recent sessions
  const filteredSessions = recentSessions.filter((session) => {
    const titleMatch =
      session.meeting?.title
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      session.failureReason
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      session.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!titleMatch) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "STUCK") {
      return stuckSessions.some((s) => s._id === session._id);
    }
    return session.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Recording Session Analytics
            </h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            BE metrics for chunk counts, duration, retries, failure reasons, and
            stuck recordings.
          </p>
        </div>

        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stuck IN_PROGRESS Recordings Alert Banner */}
      {stuckSessions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                Stuck Recording Alerts ({stuckSessions.length})
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                The following recordings have been in{" "}
                <strong>IN_PROGRESS</strong> status without heartbeat or chunk
                updates for over 10 minutes.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {stuckSessions.map((session) => (
              <div
                key={session._id}
                className="bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/40 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {session.meeting?.title || "Untitled Recording"}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded-full uppercase">
                      IN_PROGRESS (STUCK)
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                    <span>
                      User:{" "}
                      {session.user?.name || session.user?.email || "Unknown"}
                    </span>
                    <span>•</span>
                    <span>Chunks: {session.chunkCount || 0}</span>
                    <span>•</span>
                    <span>
                      Last heartbeat: {formatTimeAgo(session.lastHeartbeatAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() =>
                      handleResolveStuck(
                        session._id,
                        "FAILED",
                        "Stuck IN_PROGRESS marked failed by admin",
                      )
                    }
                    disabled={resolvingId === session._id}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Mark Failed
                  </button>
                  <button
                    onClick={() =>
                      handleResolveStuck(
                        session._id,
                        "COMPLETED",
                        "Stuck IN_PROGRESS force completed",
                      )
                    }
                    disabled={resolvingId === session._id}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Force Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Total Sessions
            </span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {metrics?.totalSessions || 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics?.statusCounts?.COMPLETED || 0} completed
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Total Duration
            </span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatDuration(metrics?.totalDuration)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Avg: {formatDuration(metrics?.avgDuration)} / session
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Chunk Counts
            </span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {metrics?.totalChunkCount || 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Avg: {metrics?.avgChunkCount || 0} chunks / session
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Retry Counts
            </span>
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {metrics?.totalRetryCount || 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Retry rate: {metrics?.retryRate || 0}%
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Failure Rate
            </span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {metrics?.failureRate || 0}%
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics?.statusCounts?.FAILED || 0} failed sessions
          </div>
        </div>
      </div>

      {/* Failure Reasons Breakdown Section */}
      {metrics?.failureReasons && metrics.failureReasons.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Failure Reasons Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.failureReasons.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 flex items-center justify-between"
              >
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[260px]">
                  {item.reason}
                </span>
                <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold text-xs rounded-full">
                  {item.count} occurrences
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions Data Table Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-500" />
            Recent Recording Sessions
          </h3>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search meeting, user, failure..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {["ALL", "IN_PROGRESS", "COMPLETED", "FAILED", "STUCK"].map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      statusFilter === filter
                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    {filter}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                <th className="pb-3 px-3">Meeting / User</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Duration</th>
                <th className="pb-3 px-3">Chunks</th>
                <th className="pb-3 px-3">Retries</th>
                <th className="pb-3 px-3">Failure Reason</th>
                <th className="pb-3 px-3">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="py-8 text-center text-slate-400 dark:text-slate-500"
                  >
                    No recording sessions found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const isStuck = stuckSessions.some(
                    (s) => s._id === session._id,
                  );
                  return (
                    <tr
                      key={session._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {session.meeting?.title || "Untitled Meeting"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {session.user?.name ||
                            session.user?.email ||
                            "Unknown User"}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {session.status === "COMPLETED" && (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> COMPLETED
                          </span>
                        )}
                        {session.status === "IN_PROGRESS" && (
                          <span
                            className={`px-2 py-0.5 font-bold text-[10px] rounded-full inline-flex items-center gap-1 ${
                              isStuck
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 animate-pulse"
                                : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            <Zap className="w-3 h-3" />{" "}
                            {isStuck ? "STUCK" : "IN_PROGRESS"}
                          </span>
                        )}
                        {session.status === "FAILED" && (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> FAILED
                          </span>
                        )}
                        {session.status === "PAUSED" && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                            <PauseCircle className="w-3 h-3" /> PAUSED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {formatDuration(session.duration)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {session.chunkCount || 0}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {session.retryCount > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {session.retryCount}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-3 px-3 max-w-[200px] truncate text-slate-500 dark:text-slate-400">
                        {session.failureReason ? (
                          <span
                            className="text-red-600 dark:text-red-400 font-medium"
                            title={session.failureReason}
                          >
                            {session.failureReason}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {formatTimeAgo(
                          session.lastHeartbeatAt || session.updatedAt,
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecordingSessionAnalyticsPanel;
