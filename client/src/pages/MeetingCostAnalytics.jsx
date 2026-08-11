import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  BarChart3,
  Clock3,
  Download,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getOrgCostAnalytics,
  getMemberTimeStats,
  exportCostReport,
} from "../services";
import ErrorState from "../components/ErrorState";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#f97316", "#8b5cf6"];

const cardClass =
  "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm";

const inputClass =
  "w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const ChartEmptyState = ({ message = "No data available for this period" }) => (
  <div className="h-full min-h-[12rem] flex flex-col items-center justify-center gap-2 text-center px-4">
    <BarChart3
      className="h-10 w-10 text-gray-300 dark:text-gray-600"
      aria-hidden="true"
    />
    <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
  </div>
);

const MeetingCostAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [memberStats, setMemberStats] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [analyticsRes, memberRes] = await Promise.all([
        getOrgCostAnalytics(params),
        getMemberTimeStats(params),
      ]);

      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data);
      }
      if (memberRes.success) {
        setMemberStats(memberRes.data);
      }
    } catch (err) {
      console.error("Error fetching cost data:", err);
      setError("We could not load meeting cost analytics. Please try again.");
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const blob = await exportCostReport(params);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "meeting_cost_report.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      console.error("Error exporting data:", err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleClearDates = () => {
    setStartDate("");
    setEndDate("");
  };

  const formatCurrency = (amount) => {
    const code = analytics?.currency || "USD";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).format(amount || 0);
    } catch {
      return `$${(amount || 0).toFixed(2)}`;
    }
  };

  const hasDateFilter = Boolean(startDate || endDate);
  const hasAnyData =
    Boolean(analytics?.costByMonth?.length) ||
    Boolean(analytics?.costByType?.length) ||
    memberStats.length > 0 ||
    Boolean(analytics?.totalCost) ||
    Boolean(analytics?.totalTimeHours);

  if (loading && !analytics) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div
          className={`${cardClass} p-10 flex flex-col items-center justify-center gap-3`}
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Loading analytics...
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Fetching cost and time investment data
          </p>
        </div>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <ErrorState
          title="Unable to load analytics"
          message={error}
          onRetry={fetchData}
          retryText="Retry"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
      {/* Header + toolbar */}
      <div className="flex flex-col gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Meeting Cost & Time Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track organizational spend and time investment across meetings.
          </p>
        </div>

        <div
          className={`${cardClass} p-3 sm:p-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 w-full lg:w-auto lg:flex-1 min-w-0">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Start date
              </span>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
              />
            </label>
            <span className="hidden sm:flex items-end justify-center pb-2 text-sm text-gray-400 dark:text-gray-500">
              to
            </span>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                End date
              </span>
              <input
                type="date"
                className={inputClass}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="End date"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto shrink-0">
            {hasDateFilter && (
              <button
                type="button"
                onClick={handleClearDates}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
              aria-label="Refresh analytics"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 sm:py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60 w-full sm:w-auto"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>
      </div>

      {!hasAnyData && !loading ? (
        <div
          className={`${cardClass} p-10 flex flex-col items-center justify-center gap-3 text-center`}
        >
          <BarChart3
            className="h-12 w-12 text-gray-300 dark:text-gray-600"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            No analytics data yet
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
            {hasDateFilter
              ? "No meetings match the selected date range. Try widening the filter or clearing dates."
              : "Once meetings with cost data are recorded, totals and charts will appear here."}
          </p>
          {hasDateFilter && (
            <button
              type="button"
              onClick={handleClearDates}
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Clear date filter
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className={`${cardClass} p-5 sm:p-6`}>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
                  Total Meeting Cost
                </h2>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mt-3 break-words">
                {formatCurrency(analytics?.totalCost)}
              </p>
            </div>
            <div className={`${cardClass} p-5 sm:p-6`}>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
                  Total Time Investment
                </h2>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mt-3">
                {analytics?.totalTimeHours?.toFixed(1) || 0}{" "}
                <span className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                  hrs
                </span>
              </p>
            </div>
            <div
              className={`${cardClass} p-5 sm:p-6 sm:col-span-2 lg:col-span-1`}
            >
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
                  Most Expensive Meeting
                </h2>
              </div>
              {analytics?.mostExpensiveMeeting ? (
                <div className="mt-3 min-w-0">
                  <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                    {analytics.mostExpensiveMeeting.title}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 font-semibold mt-1">
                    {formatCurrency(analytics.mostExpensiveMeeting.cost)}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 mt-3 text-sm">
                  No meetings found
                </p>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className={`${cardClass} p-4 sm:p-6`}>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Cost by Month
              </h2>
              <div className="h-64 sm:h-80 w-full min-w-0">
                {analytics?.costByMonth?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.costByMonth}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                        className="dark:opacity-30"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        formatter={(val) => formatCurrency(val)}
                        contentStyle={{
                          backgroundColor: "var(--tooltip-bg, #ffffff)",
                          borderColor: "#e5e7eb",
                          borderRadius: "0.5rem",
                          color: "#111827",
                        }}
                      />
                      <Bar
                        dataKey="cost"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState />
                )}
              </div>
            </div>

            <div className={`${cardClass} p-4 sm:p-6`}>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Cost by Type
              </h2>
              <div className="h-64 sm:h-80 w-full min-w-0">
                {analytics?.costByType?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.costByType}
                        dataKey="cost"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius="70%"
                        fill="#8884d8"
                        label={({ type }) => type}
                      >
                        {analytics.costByType.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.type || index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => formatCurrency(val)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState />
                )}
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Users
                className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0"
                aria-hidden="true"
              />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                Member Time Leaderboard
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300 text-sm">
                    <th className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 font-semibold">
                      Name
                    </th>
                    <th className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 font-semibold">
                      Email
                    </th>
                    <th className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 font-semibold text-right whitespace-nowrap">
                      Meetings
                    </th>
                    <th className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 font-semibold text-right whitespace-nowrap">
                      Hours
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memberStats.length > 0 ? (
                    memberStats.map((member, index) => (
                      <tr
                        key={member.email || member.name || index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700/80 last:border-0"
                      >
                        <td className="p-3 sm:p-4 text-gray-900 dark:text-gray-100 font-medium">
                          {member.name}
                        </td>
                        <td className="p-3 sm:p-4 text-gray-500 dark:text-gray-400 break-all">
                          {member.email || "—"}
                        </td>
                        <td className="p-3 sm:p-4 text-right text-gray-800 dark:text-gray-200">
                          {member.totalMeetings}
                        </td>
                        <td className="p-3 sm:p-4 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {member.totalHours?.toFixed(1)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="p-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        No member time data for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MeetingCostAnalytics;
