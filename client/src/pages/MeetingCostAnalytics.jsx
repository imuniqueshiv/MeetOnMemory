import React, { useState, useEffect } from "react";
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
  getOrgCostAnalytics,
  getMemberTimeStats,
  exportCostReport,
} from "../services";
import { useCallback } from "react";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const MeetingCostAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [memberStats, setMemberStats] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
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
    } catch (error) {
      console.error("Error fetching cost data:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
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
      toast.success("Export downloaded");
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Export failed");
    }
  };

  if (loading && !analytics) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }

  const formatCurrency = (amount) => {
    const code = analytics?.currency || "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amount || 0);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Meeting Cost & Time Analytics
        </h1>
        <div className="flex items-center space-x-4">
          <input
            type="date"
            className="border p-2 rounded"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            className="border p-2 rounded"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <button
            onClick={handleExport}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">
            Total Meeting Cost
          </h2>
          <p className="text-4xl font-bold text-gray-800 mt-2">
            {formatCurrency(analytics?.totalCost)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">
            Total Time Investment
          </h2>
          <p className="text-4xl font-bold text-gray-800 mt-2">
            {analytics?.totalTimeHours?.toFixed(1) || 0} hrs
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">
            Most Expensive Meeting
          </h2>
          {analytics?.mostExpensiveMeeting ? (
            <div>
              <p className="text-lg font-bold text-gray-800 mt-2 truncate">
                {analytics.mostExpensiveMeeting.title}
              </p>
              <p className="text-sm text-red-600 font-semibold">
                {formatCurrency(analytics.mostExpensiveMeeting.cost)}
              </p>
            </div>
          ) : (
            <p className="text-gray-500 mt-2">No meetings found</p>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow h-96">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Cost by Month
          </h2>
          {analytics?.costByMonth?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.costByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Bar dataKey="cost" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow h-96">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Cost by Type</h2>
          {analytics?.costByType?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.costByType}
                  dataKey="cost"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  label={(entry) => entry.type}
                >
                  {analytics.costByType.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            Member Time Leaderboard
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-700 text-sm">
                <th className="p-4 border-b">Name</th>
                <th className="p-4 border-b">Email</th>
                <th className="p-4 border-b text-right">Meetings Attended</th>
                <th className="p-4 border-b text-right">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {memberStats.length > 0 ? (
                memberStats.map((member, index) => (
                  <tr
                    key={member.email || index}
                    className="hover:bg-gray-50 border-b last:border-0"
                  >
                    <td className="p-4">{member.name}</td>
                    <td className="p-4 text-gray-500">{member.email || "-"}</td>
                    <td className="p-4 text-right">{member.totalMeetings}</td>
                    <td className="p-4 text-right font-semibold">
                      {member.totalHours?.toFixed(1)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500">
                    No data available for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MeetingCostAnalytics;
