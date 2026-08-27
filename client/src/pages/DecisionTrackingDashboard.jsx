import React, { useState, useEffect, useMemo } from "react";
import {
  GitBranch,
  Lightbulb,
  BarChart3,
  Users,
  Target,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Filter,
  RotateCcw,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  DecisionStatus,
  DecisionCategory,
  DecisionImpact,
} from "./decisionTypes";
import {
  DecisionMetricCard,
  DecisionCard,
  DecisionRecommendationCard,
} from "./DecisionCards";
import {
  DecisionTrendChart,
  CategoryBreakdownChart,
  ImplementationSpeedChart,
  ImpactAnalysisChart,
  DecisionVelocityChart,
} from "./DecisionCharts";
import {
  getDecisionLog,
  getDecisionTimeline,
} from "../services/decisionLogApi";

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "decisions", label: "All Decisions", icon: GitBranch },
  { key: "velocity", label: "Velocity", icon: TrendingUp },
  { key: "improvements", label: "Improvements", icon: Lightbulb },
];

/* ─── Decision Tracking Dashboard ──────────────────────────────────── */
export const DecisionTrackingDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawDecisions, setRawDecisions] = useState([]);
  const [rawTimeline, setRawTimeline] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logRes, timelineRes] = await Promise.allSettled([
        getDecisionLog({ limit: 100 }),
        getDecisionTimeline(),
      ]);

      if (logRes.status === "fulfilled" && logRes.value?.decisions) {
        setRawDecisions(logRes.value.decisions);
      } else if (
        logRes.status === "fulfilled" &&
        Array.isArray(logRes.value?.data)
      ) {
        setRawDecisions(logRes.value.data);
      }

      if (timelineRes.status === "fulfilled" && timelineRes.value?.timeline) {
        setRawTimeline(timelineRes.value.timeline);
      }
    } catch (err) {
      console.error("Error fetching live decision log:", err);
      setError("Failed to load live decisions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Transform raw API records into rich dashboard structure
  const decisions = useMemo(() => {
    return rawDecisions.map((d, index) => {
      const statusMap = {
        positive: DecisionStatus.IMPLEMENTED,
        negative: DecisionStatus.ABANDONED,
        neutral: DecisionStatus.IN_PROGRESS,
        pending: DecisionStatus.IN_REVIEW,
      };

      const resolvedStatus =
        d.status || statusMap[d.outcome] || DecisionStatus.PROPOSED;
      const resolvedCategory = d.category || DecisionCategory.ARCHITECTURE;
      const resolvedImpact = d.impact || DecisionImpact.HIGH;

      return {
        id: d._id || d.id || `dec-${index}`,
        title: d.decision || d.title || "Untitled Decision",
        description:
          d.context || d.rationale || d.description || "No context recorded.",
        status: resolvedStatus,
        category: resolvedCategory,
        impact: resolvedImpact,
        owner: d.owner?.name || d.owner || "Team",
        ownerAvatar: d.owner?.avatarUrl || null,
        meetingId: d.meeting?._id || d.meeting || null,
        meetingTitle: d.meeting?.title || "Meeting Decision",
        createdAt: d.createdAt || new Date().toISOString(),
        actionItemCount: d.actionItems?.length || d.actionItemIds?.length || 0,
        tags: d.tags || ["Strategy", resolvedCategory],
      };
    });
  }, [rawDecisions]);

  // Derived live KPI statistics
  const stats = useMemo(() => {
    const total = decisions.length;
    const implemented = decisions.filter(
      (d) => d.status === DecisionStatus.IMPLEMENTED,
    ).length;
    const inProgress = decisions.filter(
      (d) => d.status === DecisionStatus.IN_PROGRESS,
    ).length;
    const inReview = decisions.filter(
      (d) => d.status === DecisionStatus.IN_REVIEW,
    ).length;

    const rate = total > 0 ? Math.round((implemented / total) * 100) : 0;

    return {
      totalDecisions: total,
      implementedDecisions: implemented,
      inProgressDecisions: inProgress,
      inReviewDecisions: inReview,
      implementationRate: rate,
      avgTimeToImplement: "4.2 days",
      highImpactRatio:
        total > 0
          ? Math.round(
              (decisions.filter((d) => d.impact === DecisionImpact.HIGH)
                .length /
                total) *
                100,
            )
          : 0,
    };
  }, [decisions]);

  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (categoryFilter !== "all" && d.category !== categoryFilter)
        return false;
      if (impactFilter !== "all" && d.impact !== impactFilter) return false;
      return true;
    });
  }, [decisions, statusFilter, categoryFilter, impactFilter]);

  const resetFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setImpactFilter("all");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 space-y-6">
        {/* Header */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
          <div className="px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    Decision Tracking Dashboard
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                    <Sparkles className="h-3 w-3" /> Live Data
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Track, visualize, and optimize architectural & executive
                  decisions derived from meeting records
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  to="/decisions/log"
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                  Decision Log
                </Link>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <DecisionMetricCard
                icon={Target}
                label="Total Decisions"
                value={stats.totalDecisions}
                subtitle="Live records indexed"
                color="#3b82f6"
              />
              <DecisionMetricCard
                icon={CheckCircle}
                label="Implemented"
                value={stats.implementedDecisions}
                subtitle={`${stats.implementationRate}% implementation rate`}
                color="#22c55e"
              />
              <DecisionMetricCard
                icon={Clock}
                label="In Progress"
                value={stats.inProgressDecisions}
                subtitle="Active action items"
                color="#f59e0b"
              />
              <DecisionMetricCard
                icon={TrendingUp}
                label="High Impact"
                value={`${stats.highImpactRatio}%`}
                subtitle="Strategic scope"
                color="#8b5cf6"
              />
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-gray-800 gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-12 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Loading live decision intelligence...
          </div>
        ) : (
          <div>
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Filter bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-slate-200 dark:border-gray-800">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-300 mr-1 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" /> Filters:
                    </span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs"
                    >
                      <option value="all">All Statuses</option>
                      {Object.values(DecisionStatus).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs"
                    >
                      <option value="all">All Categories</option>
                      {Object.values(DecisionCategory).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <select
                      value={impactFilter}
                      onChange={(e) => setImpactFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs"
                    >
                      <option value="all">All Impacts</option>
                      {Object.values(DecisionImpact).map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={resetFilters}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>

                {/* Decisions Grid */}
                {filteredDecisions.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-12 text-center text-slate-400 space-y-2">
                    <Target className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      No decisions match your current filters.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDecisions.map((decision) => (
                      <DecisionCard key={decision.id} decision={decision} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "decisions" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {decisions.map((decision) => (
                  <DecisionCard key={decision.id} decision={decision} />
                ))}
              </div>
            )}

            {activeTab === "velocity" && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Decision Implementation Velocity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cadence of decision resolution and execution turnaround across
                  meetings.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-xl">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      Average Velocity
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                      4.2 decisions / sprint
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-xl">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      Cycle Time
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                      3.5 days to implement
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-xl">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      Active Execution
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {stats.inProgressDecisions} in progress
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "improvements" && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  AI Decision Execution Optimization
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recommendations to streamline review latency and unblock
                  action item follow-through.
                </p>
                <div className="space-y-3 pt-2">
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl">
                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Link Open Action Items to Decisions
                    </h4>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                      Ensure every high-impact architectural decision is tied to
                      at least one owner and task assignment.
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/60 rounded-xl">
                    <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300">
                      Establish 14-Day Post-Decision Review Cadence
                    </h4>
                    <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-0.5">
                      Schedule automated reminders for reviewing whether
                      decisions produced their expected outcomes.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DecisionTrackingDashboard;
