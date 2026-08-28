import React, { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { speakingTimeApi } from "../services";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";

const formatDuration = (seconds = 0) => {
  const sec = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s}s`;
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-md rounded-md">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {data.speakerName || "Unknown"}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Avg Talk Ratio: {(data.averageTalkRatio || 0).toFixed(1)}%
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Total Duration: {formatDuration(data.totalDuration)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Meetings Spoken In: {data.meetingCount || 0}
        </p>
      </div>
    );
  }
  return null;
};

const SpeakingTimeCompare = () => {
  const getNDaysAgo = (n) => {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date.toISOString().split("T")[0];
  };

  const getToday = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [startDate, setStartDate] = useState(getNDaysAgo(30));
  const [endDate, setEndDate] = useState(getToday());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCompareData = useCallback(async (start, end) => {
    try {
      setLoading(true);
      setError(null);
      const res = await speakingTimeApi.getOrgCompare(start, end);
      if (res?.data?.success) {
        setData(res.data.data);
      } else {
        const errorMsg =
          res?.data?.message || "Failed to load organization comparison data";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error("Error fetching compare data:", err);
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while loading team comparison data";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompareData(startDate, endDate);
  }, [startDate, endDate, fetchCompareData]);

  const handleQuickSelect = (days) => {
    const start = getNDaysAgo(days);
    const end = getToday();
    setStartDate(start);
    setEndDate(end);
  };

  const handleExportCSV = () => {
    if (
      !data ||
      !Array.isArray(data.memberStats) ||
      data.memberStats.length === 0
    )
      return;

    const headers = [
      "Member Name",
      "Average Talk Ratio (%)",
      "Total Speaking Duration (Seconds)",
      "Total Speaking Duration (Formatted)",
      "Meetings Spoken In",
    ];

    const rows = data.memberStats.map((stat) => {
      const name = stat?.speakerName
        ? String(stat.speakerName).replace(/"/g, '""')
        : "Unknown";
      const talkRatio = (Number(stat?.averageTalkRatio) || 0).toFixed(2);
      const duration = Number(stat?.totalDuration) || 0;
      const formattedDuration = formatDuration(duration);
      const meetings = Number(stat?.meetingCount) || 0;

      return [
        `"${name}"`,
        talkRatio,
        duration,
        `"${formattedDuration}"`,
        meetings,
      ];
    });

    const csvText = [headers.join(","), ...rows.map((e) => e.join(","))].join(
      "\n",
    );

    try {
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `team_speaking_time_compare_${startDate}_to_${endDate}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvText);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `team_speaking_time_compare_${startDate}_to_${endDate}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const chartData =
    data?.memberStats?.map((stat) => ({
      ...stat,
      totalDurationMins: Math.round((Number(stat?.totalDuration) || 0) / 60),
    })) || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors flex flex-col">
      <Navbar />
      <div className="max-w-6xl mx-auto w-full pt-24 pb-20 px-4 sm:px-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Team Speaking Time Comparison
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Compare participation metrics and talking ratios across your
              organization.
            </p>
          </div>
          {data?.memberStats?.length > 0 && !error && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {/* Date Range Selector & Controls */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Quick Ranges:
            </span>
            <button
              onClick={() => handleQuickSelect(7)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-semibold rounded-lg transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handleQuickSelect(30)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-semibold rounded-lg transition-colors"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handleQuickSelect(90)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-semibold rounded-lg transition-colors"
            >
              Last 90 Days
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchCompareData(startDate, endDate);
            }}
            className="flex flex-wrap items-center gap-3 w-full md:w-auto"
          >
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <svg
                className="w-6 h-6 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-sm sm:text-base">
                  Failed to load team comparison
                </h3>
                <p className="text-xs sm:text-sm text-red-600 dark:text-red-300 mt-0.5">
                  {error}
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchCompareData(startDate, endDate)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow transition-colors shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : !error &&
          (!data || data.meetingCount === 0 || chartData.length === 0) ? (
          /* Empty State */
          <div className="bg-white dark:bg-gray-800 p-12 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Insufficient Data
            </h3>
            <p className="text-gray-500 max-w-md">
              No meeting transcripts were found for this date range in your
              organization. Ensure your meetings have transcripts completed.
            </p>
          </div>
        ) : !error && data ? (
          /* Main Content Dashboard */
          <div className="space-y-6">
            {/* Overview Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Meetings Analyzed
                </p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-2">
                  {data.meetingCount || 0}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Average Talk Ratio
                </p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-2">
                  {(data.avgTalkRatio || 0).toFixed(1)}%
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Median Talk Ratio
                </p>
                <p className="text-3xl font-extrabold text-indigo-600 mt-2">
                  {(data.medianTalkRatio || 0).toFixed(1)}%
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Most Active Member
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-3 truncate">
                  {data.topSpeakers?.[0]?.speakerName || "None"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.topSpeakers?.[0]
                    ? formatDuration(data.topSpeakers[0].totalDuration)
                    : "0s"}
                </p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Average Talk Ratio Bar Chart */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Average Talk Ratio (%)
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="speakerName" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="averageTalkRatio"
                        fill="#3B82F6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Total Duration Bar Chart */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Total Speaking Duration (Minutes)
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="speakerName" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="totalDurationMins"
                        fill="#8B5CF6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detailed Member Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Member Details Breakdown
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm text-gray-600 dark:text-gray-400">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-700 dark:text-gray-300">
                    <tr>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Team Member
                      </th>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Average Talk Ratio
                      </th>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Total Speaking Time
                      </th>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Meetings Spoken In
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.memberStats.map((stat) => (
                      <tr
                        key={stat.identifier}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                          {stat.speakerName || "Unknown"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="w-10">
                              {(stat.averageTalkRatio || 0).toFixed(1)}%
                            </span>
                            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, stat.averageTalkRatio || 0))}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {formatDuration(stat.totalDuration)}
                        </td>
                        <td className="px-6 py-4">{stat.meetingCount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SpeakingTimeCompare;
