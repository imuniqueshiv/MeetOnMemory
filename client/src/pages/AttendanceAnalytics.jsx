import React, { useState, useEffect } from "react";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import {
  LineChart,
  Line,
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
  getAttendanceStats,
  getAttendanceHeatmap,
  getAttendanceTrends,
  getMeetingTypeBreakdown,
} from "../services/attendanceApi";
import { Calendar, Users, BarChart2, Filter } from "lucide-react";
import useTheme from "../context/useTheme.jsx";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const cardClass =
  "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700";

const inputClass =
  "border border-gray-300 dark:border-gray-600 rounded p-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

const AttendanceAnalytics = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartTheme = {
    grid: isDark ? "#374151" : "#e5e7eb",
    tick: isDark ? "#9ca3af" : "#6b7280",
    legend: isDark ? "#d1d5db" : "#374151",
    tooltip: {
      backgroundColor: isDark ? "#1f2937" : "#ffffff",
      borderColor: isDark ? "#374151" : "#e5e7eb",
      color: isDark ? "#f3f4f6" : "#111827",
    },
  };

  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [granularity, setGranularity] = useState("daily");
  const [dateError, setDateError] = useState("");

  const [stats, setStats] = useState([]);
  const [totalOrgMeetings, setTotalOrgMeetings] = useState(0);
  const [heatmapData, setHeatmapData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [typeBreakdown, setTypeBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate date range ordering (#1367)
    if (
      dateRange.startDate &&
      dateRange.endDate &&
      dateRange.startDate > dateRange.endDate
    ) {
      setDateError("Start date cannot be after end date");
      setLoading(false);
      return;
    }
    setDateError("");

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        };

        const [statsRes, heatmapRes, trendsRes, typesRes] = await Promise.all([
          getAttendanceStats(params),
          getAttendanceHeatmap(params),
          getAttendanceTrends({ ...params, granularity }),
          getMeetingTypeBreakdown(params),
        ]);

        // Sort stats by attendance count
        const sortedStats = (statsRes.stats || []).sort(
          (a, b) => b.attended - a.attended,
        );
        setStats(sortedStats);
        setTotalOrgMeetings(statsRes.totalMeetings || 0);
        setHeatmapData(heatmapRes || []);
        setTrendsData(trendsRes || []);
        setTypeBreakdown(typesRes || []);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, granularity]);

  const handleDateChange = (e) => {
    setDateRange({ ...dateRange, [e.target.name]: e.target.value });
  };

  const renderHeatmap = () => {
    if (!dateRange.startDate || !dateRange.endDate) return null;
    const start = parseISO(dateRange.startDate);
    const end = parseISO(dateRange.endDate);

    // Fill days
    const days = eachDayOfInterval({ start, end });

    const getColor = (count) => {
      if (isDark) {
        if (!count || count === 0) return "#21262d";
        if (count === 1) return "#0e4429";
        if (count === 2) return "#006d32";
        if (count === 3) return "#26a641";
        return "#39d353";
      }
      if (!count || count === 0) return "#ebedf0";
      if (count === 1) return "#c6e48b";
      if (count === 2) return "#7bc96f";
      if (count === 3) return "#239a3b";
      return "#196127";
    };

    return (
      <div className="heatmap-container overflow-x-auto pb-4">
        <div className="flex gap-1" style={{ minWidth: "max-content" }}>
          {days.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dataPoint = heatmapData.find((d) => d.date === dateStr);
            const count = dataPoint ? dataPoint.count : 0;
            return (
              <div
                key={i}
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: getColor(count) }}
                title={`${dateStr}: ${count} meetings`}
              />
            );
          })}
        </div>
        <div className="flex text-xs text-gray-500 dark:text-gray-400 mt-2 justify-between">
          <span>{format(start, "MMM d")}</span>
          <span>{format(end, "MMM d")}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <BarChart2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Attendance Analytics
          </h1>

          <div className={`flex flex-wrap items-center gap-4 ${cardClass} p-3`}>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter:
              </span>
            </div>
            <input
              type="date"
              name="startDate"
              value={dateRange.startDate}
              onChange={handleDateChange}
              className={inputClass}
            />
            <span className="text-gray-400 dark:text-gray-500">-</span>
            <input
              type="date"
              name="endDate"
              value={dateRange.endDate}
              onChange={handleDateChange}
              className={inputClass}
            />
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              className={`${inputClass} ml-2`}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {dateError && (
          <div
            role="alert"
            className="p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 text-sm font-medium"
          >
            {dateError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Heatmap Card */}
              <div className={`${cardClass} p-6 col-span-1 md:col-span-2`}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  Meeting Activity Heatmap
                </h2>
                {renderHeatmap()}
              </div>

              {/* Trends Chart */}
              <div className={`${cardClass} p-6 h-96`}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Attendance Trends
                </h2>
                {trendsData.length === 0 ? (
                  <div className="h-[calc(100%-2rem)] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    No trend data for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartTheme.grid}
                      />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fill: chartTheme.tick, fontSize: 12 }}
                        stroke={chartTheme.grid}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: chartTheme.tick, fontSize: 12 }}
                        stroke={chartTheme.grid}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: chartTheme.tick, fontSize: 12 }}
                        stroke={chartTheme.grid}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.tooltip.backgroundColor,
                          borderColor: chartTheme.tooltip.borderColor,
                          borderRadius: "0.5rem",
                          color: chartTheme.tooltip.color,
                        }}
                      />
                      <Legend wrapperStyle={{ color: chartTheme.legend }} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="totalParticipants"
                        stroke="#8884d8"
                        name="Total Participants"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="meetings"
                        stroke="#82ca9d"
                        name="Meetings Held"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Meeting Types Pie */}
              <div className={`${cardClass} p-6 h-96`}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Meeting Type Breakdown
                </h2>
                {typeBreakdown.length === 0 ? (
                  <div className="h-[calc(100%-2rem)] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    No meeting type data for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        labelLine={{ stroke: chartTheme.tick }}
                        label={({
                          cx,
                          cy,
                          midAngle,
                          outerRadius,
                          name,
                          percent,
                        }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius + 18;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill={chartTheme.tick}
                              textAnchor={x > cx ? "start" : "end"}
                              dominantBaseline="central"
                              fontSize={12}
                            >
                              {`${name} ${(percent * 100).toFixed(0)}%`}
                            </text>
                          );
                        }}
                      >
                        {typeBreakdown.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.tooltip.backgroundColor,
                          borderColor: chartTheme.tooltip.borderColor,
                          borderRadius: "0.5rem",
                          color: chartTheme.tooltip.color,
                        }}
                      />
                      <Legend wrapperStyle={{ color: chartTheme.legend }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Member Attendance Table */}
            <div className={`${cardClass} overflow-hidden`}>
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  Top Participants Leaderboard
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Based on {totalOrgMeetings} total meetings in range
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 text-sm">
                      <th className="p-4 font-semibold">Rank</th>
                      <th className="p-4 font-semibold">Member</th>
                      <th className="p-4 font-semibold text-right">
                        Meetings Attended
                      </th>
                      <th className="p-4 font-semibold text-right">
                        Attendance Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {stats.map((member, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="p-4 text-gray-500 dark:text-gray-400 font-medium">
                          #{idx + 1}
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            {member.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {member.email}
                          </div>
                        </td>
                        <td className="p-4 text-right font-medium text-gray-700 dark:text-gray-300">
                          {member.attended}
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              member.attendanceRate >= 80
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : member.attendanceRate >= 40
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}
                          >
                            {member.attendanceRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {stats.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
                          className="p-8 text-center text-gray-500 dark:text-gray-400"
                        >
                          No attendance data for this period.
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
    </div>
  );
};

export default AttendanceAnalytics;
