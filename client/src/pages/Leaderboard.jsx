import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import apiClient from "../services/apiClient";
import Navbar from "../components/Navbar.jsx";

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [team, setTeam] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (period !== "all") params.append("period", period);
        if (team.trim()) params.append("team", team.trim());

        const response = await apiClient.get(
          `/api/gamification/leaderboard?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );
        if (response.data.success) {
          setLeaderboard(response.data.data);
        }
      } catch (error) {
        if (error.name !== "CanceledError" && error.code !== "ERR_CANCELED") {
          console.error("Failed to load leaderboard", error);
          toast.error("Failed to load leaderboard.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchLeaderboard();

    return () => {
      controller.abort();
    };
  }, [period, team]);

  if (loading && !leaderboard) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors flex flex-col">
        <Navbar />
        <div className="max-w-4xl mx-auto w-full pt-24 pb-20 px-4 sm:px-6 flex flex-col items-center justify-center flex-1">
          <div className="text-center text-gray-900 dark:text-gray-100 text-lg font-medium">
            Loading Leaderboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors flex flex-col">
      <Navbar />
      <div className="max-w-4xl mx-auto w-full pt-24 pb-20 px-4 sm:px-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center sm:text-left">
              🏆 Meeting Hygiene Leaderboard
            </h1>
            <Link
              to="/badges"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 self-center sm:self-auto"
            >
              Browse badges gallery
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2"
              >
                <option value="all">All Time</option>
                <option value="month">This Month</option>
                <option value="week">This Week</option>
              </select>
            </div>
            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Team Filter
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Engineering"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2 border"
                />
              </div>
            </div>
          </div>

          {leaderboard?.historyChart && leaderboard.historyChart.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                Score History (Last 30 Days)
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={leaderboard.historyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      stroke="#9CA3AF"
                      tickFormatter={(val) => {
                        if (!val) return "";
                        const parts = val.split("-");
                        if (parts.length === 3) {
                          return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
                        }
                        return val;
                      }}
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        borderColor: "#374151",
                        color: "#F3F4F6",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="points"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              Top 10 Meeting Heroes {team ? `in ${team}` : ""}{" "}
              {period !== "all" ? `(${period})` : ""}
            </h2>

            {loading ? (
              <div className="text-center py-4">Loading updates...</div>
            ) : !leaderboard?.top10 || leaderboard.top10.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                No gamification scores found for this filter.
              </div>
            ) : (
              <ul className="space-y-4">
                {leaderboard.top10.map((score, index) => (
                  <li
                    key={score._id}
                    className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-600 gap-4 sm:gap-0"
                  >
                    <div className="flex items-center space-x-4 w-full sm:w-auto">
                      <span className="text-2xl font-bold text-gray-400 w-8 text-center">
                        #{index + 1}
                      </span>
                      <img
                        src={
                          score.user?.profilePic ||
                          "https://via.placeholder.com/40"
                        }
                        alt="Profile"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex flex-col">
                        <span className="text-lg font-medium text-gray-900 dark:text-white">
                          {score.user?.name || "Unknown User"}
                        </span>
                        {score.user?.team && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Team: {score.user.team}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center sm:items-end gap-1 w-full sm:w-auto">
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {score.totalPoints} pts
                      </div>
                      <Link
                        to="/badges"
                        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View badges
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
