import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  Activity,
  Archive,
  CheckCircle2,
  Clock,
  Database,
  Flame,
  Layers,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Zap,
} from "lucide-react";

const TIMEFRAMES = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "1 Year", value: "1y" },
  { label: "All Time", value: "all" },
];

const EnterpriseMemoryTelemetry = () => {
  const [timeframe, setTimeframe] = useState("30d");
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await knowledgeApi.getMemoryTelemetry(timeframe);
      if (res.data?.success && res.data?.telemetry) {
        setTelemetry(res.data.telemetry);
      } else {
        setError(res.data?.message || "Failed to load memory telemetry");
        toast.error(res.data?.message || "Failed to load memory telemetry");
      }
    } catch (err) {
      console.error("Fetch telemetry error:", err);
      const errMsg =
        err.response?.data?.message || "Error fetching telemetry data";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  const summary = telemetry?.summary || {};
  const lifecycle = telemetry?.lifecycleDistribution || {};
  const importance = telemetry?.importanceMetrics || {};
  const velocity = telemetry?.velocityMetrics || {};
  const consolidation = telemetry?.consolidationMetrics || {};
  const recommendations = telemetry?.recommendations || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Enterprise Memory Telemetry
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Real-time analytics on knowledge retention, lifecycle
                  distribution, and memory access velocity.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timeframe selector */}
            <div className="inline-flex p-1 rounded-xl bg-slate-900/90 border border-slate-800">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    timeframe === tf.value
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <button
              onClick={fetchTelemetry}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50"
              title="Refresh telemetry"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Loading telemetry metrics...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-200 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-rose-300">
                Unable to load telemetry
              </h3>
              <p className="text-xs text-rose-400 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* High Level KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Memories */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Enterprise Memories
                  </span>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Database className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    {summary.totalMemories || 0}
                  </span>
                  <span className="text-xs text-slate-400">records</span>
                </div>
                <div className="mt-2 text-xs text-slate-400 flex items-center gap-3">
                  <span>{summary.decisionsCount || 0} Decisions</span>
                  <span>•</span>
                  <span>{summary.actionItemsCount || 0} Action Items</span>
                </div>
              </div>

              {/* Memory Health Score */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Memory Health Score
                  </span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-emerald-400">
                    {summary.memoryHealthScore || 0}
                  </span>
                  <span className="text-xs text-slate-400">/ 100</span>
                </div>
                <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, summary.memoryHealthScore || 0)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Active Ratio */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Active Ratio
                  </span>
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    {summary.activeRatioPercentage || 0}%
                  </span>
                  <span className="text-xs text-slate-400">of total pool</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {lifecycle.active || 0} memories currently active
                </div>
              </div>

              {/* Importance Protection */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Protected Memories
                  </span>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-300">
                    {importance.protectedCount || 0}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({importance.protectedPercentage || 0}%)
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Shielded from auto-archival (&ge;70 score)
                </div>
              </div>
            </div>

            {/* Mid Section: Lifecycle & Importance Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lifecycle Distribution Card */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-semibold text-white">
                      Memory Lifecycle State Breakdown
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-center">
                    <span className="text-xs font-medium text-emerald-400 block uppercase">
                      Active
                    </span>
                    <span className="text-2xl font-bold text-emerald-300 mt-1 block">
                      {lifecycle.active || 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-center">
                    <span className="text-xs font-medium text-amber-400 block uppercase">
                      Dormant
                    </span>
                    <span className="text-2xl font-bold text-amber-300 mt-1 block">
                      {lifecycle.dormant || 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-center">
                    <span className="text-xs font-medium text-blue-400 block uppercase">
                      Archived
                    </span>
                    <span className="text-2xl font-bold text-blue-300 mt-1 block">
                      {lifecycle.archived || 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 text-center">
                    <span className="text-xs font-medium text-rose-400 block uppercase">
                      Expired
                    </span>
                    <span className="text-2xl font-bold text-rose-300 mt-1 block">
                      {lifecycle.expired || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Importance Score Distribution */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-semibold text-white">
                      Importance Score Tiering
                    </h2>
                  </div>
                  <span className="text-xs font-medium text-slate-400">
                    Avg Score:{" "}
                    <strong className="text-white">
                      {importance.averageScore || 0}
                    </strong>
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                      <span>High Importance (&ge; 70)</span>
                      <span>{importance.distribution?.high || 0} memories</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{
                          width: `${
                            summary.totalMemories
                              ? Math.min(
                                  100,
                                  Math.round(
                                    ((importance.distribution?.high || 0) /
                                      summary.totalMemories) *
                                      100,
                                  ),
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                      <span>Medium Importance (40-69)</span>
                      <span>
                        {importance.distribution?.medium || 0} memories
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full"
                        style={{
                          width: `${
                            summary.totalMemories
                              ? Math.min(
                                  100,
                                  Math.round(
                                    ((importance.distribution?.medium || 0) /
                                      summary.totalMemories) *
                                      100,
                                  ),
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                      <span>Low Importance (&lt; 40)</span>
                      <span>{importance.distribution?.low || 0} memories</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-600 h-full rounded-full"
                        style={{
                          width: `${
                            summary.totalMemories
                              ? Math.min(
                                  100,
                                  Math.round(
                                    ((importance.distribution?.low || 0) /
                                      summary.totalMemories) *
                                      100,
                                  ),
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Grid: Access Velocity & Health Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Access Velocity */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl lg:col-span-2 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-lg font-semibold text-white">
                      Access Velocity & Audit Telemetry
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Total Lifetime Accesses
                    </span>
                    <p className="text-xl font-bold text-white">
                      {velocity.totalAccesses || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Created in {timeframe}
                    </span>
                    <p className="text-xl font-bold text-white">
                      {velocity.createdInTimeframe || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Accessed in {timeframe}
                    </span>
                    <p className="text-xl font-bold text-white">
                      {velocity.accessedInTimeframe || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Avg Inactivity (Days)
                    </span>
                    <p className="text-xl font-bold text-white">
                      {velocity.avgDaysSinceLastAccess || 0} days
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Merged Duplicates
                    </span>
                    <p className="text-xl font-bold text-white">
                      {consolidation.mergedMemoriesCount || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Lifecycle State Transitions
                    </span>
                    <p className="text-xl font-bold text-white">
                      {consolidation.totalTransitionsLogged || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-4">
                  <Shield className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">
                    Governance Recommendations
                  </h2>
                </div>

                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs text-slate-200 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default EnterpriseMemoryTelemetry;
