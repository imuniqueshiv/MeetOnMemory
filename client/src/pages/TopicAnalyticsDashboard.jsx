import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Calendar,
  Loader2,
  FolderGit2,
} from "lucide-react";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import topicApi from "../services/topicApi";

export const TopicAnalyticsDashboard = () => {
  const { userData } = useContext(AppContent) || {};
  const orgId =
    userData?.currentOrganization?._id ||
    userData?.currentOrganization ||
    userData?.organization?._id ||
    userData?.organization;

  const [data, setData] = useState({ topics: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [velocityFilter, setVelocityFilter] = useState("all"); // all, accelerating, stable, decelerating
  const [selectedCluster, setSelectedCluster] = useState("all");

  const fetchVelocityData = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const res = await topicApi.getTopicVelocityAndTrends(orgId);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching topic trends and velocity:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchVelocityData();
  }, [fetchVelocityData]);

  const topics = data.topics || [];
  const metrics = data.metrics || {
    totalTopics: 0,
    totalMeetings: 0,
    acceleratingCount: 0,
    deceleratingCount: 0,
  };

  const clusters = [
    "all",
    ...new Set(topics.map((t) => t.cluster).filter(Boolean)),
  ];

  const filteredTopics = topics.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.cluster && t.cluster.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesVelocity =
      velocityFilter === "all" || t.velocity === velocityFilter;
    const matchesCluster =
      selectedCluster === "all" || t.cluster === selectedCluster;
    return matchesSearch && matchesVelocity && matchesCluster;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Topic Trends & Semantic Velocity
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Track accelerating discussions and cross-meeting topic
                  dynamics
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchVelocityData}
              disabled={loading}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors inline-flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Analytics
            </button>
          </div>
        </div>

        {/* Metrics KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Total Topics
              </span>
              <Layers className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {metrics.totalTopics || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Extracted across {metrics.totalMeetings || 0} meetings
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Accelerating
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {metrics.acceleratingCount || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              +25% frequency growth in past 30 days
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Stable
              </span>
              <Minus className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
              {Math.max(
                0,
                (metrics.totalTopics || 0) -
                  (metrics.acceleratingCount || 0) -
                  (metrics.deceleratingCount || 0),
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Consistent discussion cadence
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Decelerating
              </span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {metrics.deceleratingCount || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Decreased mentions vs previous period
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search topics or clusters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              {["all", "accelerating", "stable", "decelerating"].map((vel) => (
                <button
                  key={vel}
                  onClick={() => setVelocityFilter(vel)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    velocityFilter === vel
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {vel}
                </button>
              ))}
            </div>

            {clusters.length > 2 && (
              <select
                value={selectedCluster}
                onChange={(e) => setSelectedCluster(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
              >
                {clusters.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All Clusters" : c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Topics Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">
                    Topic Name
                  </th>
                  <th className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">
                    Cluster
                  </th>
                  <th className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">
                    Velocity Status
                  </th>
                  <th className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">
                    Growth (30d)
                  </th>
                  <th className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">
                    Meeting Count
                  </th>
                  <th className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">
                    Total Occurrences
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-slate-400"
                    >
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Analyzing semantic topic trends...
                    </td>
                  </tr>
                ) : filteredTopics.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-slate-400 dark:text-slate-500"
                    >
                      No topics matched your search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTopics.map((topic, idx) => (
                    <tr
                      key={topic.name || idx}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                        {topic.name}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold">
                          {topic.cluster || "General"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {topic.velocity === "accelerating" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <TrendingUp className="w-3 h-3" />
                            Accelerating
                          </span>
                        )}
                        {topic.velocity === "stable" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            <Minus className="w-3 h-3" />
                            Stable
                          </span>
                        )}
                        {topic.velocity === "decelerating" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <TrendingDown className="w-3 h-3" />
                            Decelerating
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                        {topic.growthPercentage > 0
                          ? `+${topic.growthPercentage}%`
                          : `${topic.growthPercentage}%`}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                        {topic.meetingCount} meetings
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                        {topic.totalCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicAnalyticsDashboard;
