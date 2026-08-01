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

const AttendanceAnalytics = () => {
  const { isDark } = useTheme();

  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [granularity, setGranularity] = useState("daily");

  const [stats, setStats] = useState([]);
  const [totalOrgMeetings, setTotalOrgMeetings] = useState(0);
  const [heatmapData, setHeatmapData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [typeBreakdown, setTypeBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      if (!count || count === 0) return isDark ? "#1e293b" : "#ebedf0";
      if (count === 1) return isDark ? "#065f46" : "#c6e48b";
      if (count === 2) return isDark ? "#047857" : "#7bc96f";
      if (count === 3) return isDark ? "#059669" : "#239a3b";
      return isDark ? "#10b981" : "#196127";
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
                className="w-4 h-4 rounded-sm transition-colors duration-200"
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

  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const tooltipStyle = {
    backgroundColor: isDark ? "#1e293b" : "#ffffff",
    borderColor: isDark ? "#334155" : "#e2e8f0",
    color: isDark ? "#f8fafc" : "#1e293b",
  };
  const tooltipItemStyle = { color: isDark ? "#f8fafc" : "#1e293b" };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <BarChart2 className="w-8 h-8 text-blue-600 dark:text-blue-500" />
          Attendance Analytics
        </h1>

        <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
          </div>
          <input
            type="date"
            name="startDate"
            value={dateRange.startDate}
            onChange={handleDateChange}
            className="border dark:border-slate-700 rounded p-1 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
          />
          <span className="text-gray-400 dark:text-gray-500">-</span>
          <input
            type="date"
            name="endDate"
            value={dateRange.endDate}
            onChange={handleDateChange}
            className="border dark:border-slate-700 rounded p-1 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
          />
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
            className="border dark:border-slate-700 rounded p-1 text-sm ml-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Heatmap Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 col-span-1 md:col-span-2">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
                <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                Meeting Activity Heatmap
              </h2>
              {renderHeatmap()}
            </div>

            {/* Trends Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 h-96">
              <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">Attendance Trends</h2>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="dateLabel" stroke={axisColor} tick={{ fill: axisColor }} />
                  <YAxis yAxisId="left" stroke={axisColor} tick={{ fill: axisColor }} />
                  <YAxis yAxisId="right" orientation="right" stroke={axisColor} tick={{ fill: axisColor }} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                  <Legend wrapperStyle={{ color: isDark ? "#f8fafc" : "#334155" }} />
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
            </div>

            {/* Meeting Types Pie */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 h-96">
              <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">
                Meeting Type Breakdown
              </h2>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent, x, y, cx }) => (
                      <text
                        x={x}
                        y={y}
                        fill={isDark ? "#f8fafc" : "#333"}
                        textAnchor={x > cx ? "start" : "end"}
                        dominantBaseline="central"
                        fontSize={12}
                      >
                        {`${name} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    )}
                  >
                    {typeBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                  <Legend wrapperStyle={{ color: isDark ? "#f8fafc" : "#334155" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Member Attendance Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2 dark:text-gray-100">
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
                  <tr className="bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-300 text-sm">
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
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {stats.map((member, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-4 text-gray-500 dark:text-gray-400 font-medium">
                        #{idx + 1}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-800 dark:text-gray-200">
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
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : member.attendanceRate >= 40
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {member.attendanceRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {stats.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-gray-500 dark:text-gray-400">
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
  );
};

export default AttendanceAnalytics;
