import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  Target,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  TrendingUp,
  Shield,
  Layers,
  Award,
  Compass,
  PieChart,
  BarChart3,
  Flame,
} from "lucide-react";

const TIMEFRAMES = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "1 Year", value: "1y" },
  { label: "All Time", value: "all" },
];

const EnterpriseOkrAlignmentTelemetry = () => {
  const [timeframe, setTimeframe] = useState("30d");
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await knowledgeApi.getOkrAlignmentTelemetry(timeframe);
      if (res.data?.success && res.data?.telemetry) {
        setTelemetry(res.data.telemetry);
      } else {
        const msg =
          res.data?.message || "Failed to load OKR alignment telemetry";
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error("Fetch OKR telemetry error:", err);
      const errMsg =
        err.response?.data?.message ||
        "Error fetching OKR alignment telemetry data";
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
  const statusBreakdown = telemetry?.objectiveStatusBreakdown || {};
  const pillars = telemetry?.pillarDistribution || [];
  const diagnostics = telemetry?.misalignmentDiagnostics || {};
  const recommendations = telemetry?.recommendations || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-teal-500/20">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Enterprise OKR Alignment Telemetry
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Strategic alignment metrics between enterprise objectives,
                  meeting goals, and decision outcomes.
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
                      ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
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
              title="Refresh OKR telemetry"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            <p className="text-sm font-medium">
              Loading OKR alignment telemetry...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-200 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-rose-300">
                Unable to load OKR telemetry
              </h3>
              <p className="text-xs text-rose-400 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Overall Alignment Score */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Overall Alignment Score
                  </span>
                  <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-teal-400">
                    {summary.overallAlignmentScore || 0}%
                  </span>
                  <span className="text-xs text-slate-400">aligned</span>
                </div>
                <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, summary.overallAlignmentScore || 0)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Total Objectives */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Strategic Objectives
                  </span>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Compass className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    {summary.totalObjectives || 0}
                  </span>
                  <span className="text-xs text-slate-400">meeting goals</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Tracked across organizational meetings
                </div>
              </div>

              {/* Active Key Results */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Active Key Results
                  </span>
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    {summary.activeKeyResults || 0}
                  </span>
                  <span className="text-xs text-slate-400">memories</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Decisions & Action Items supporting OKRs
                </div>
              </div>

              {/* At-Risk Objectives */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    At-Risk Objectives
                  </span>
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-rose-400">
                    {summary.atRiskObjectivesCount || 0}
                  </span>
                  <span className="text-xs text-slate-400">flagged</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Objectives requiring intervention
                </div>
              </div>
            </div>

            {/* Middle Section: Objective Status & Strategic Pillars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Objective Status Breakdown */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <PieChart className="w-5 h-5 text-teal-400" />
                    <h2 className="text-lg font-semibold text-white">
                      Objective Status Breakdown
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-center">
                    <span className="text-xs font-medium text-emerald-400 block uppercase">
                      Achieved
                    </span>
                    <span className="text-2xl font-bold text-emerald-300 mt-1 block">
                      {statusBreakdown.achieved || 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-800/40 text-center">
                    <span className="text-xs font-medium text-teal-400 block uppercase">
                      On Track
                    </span>
                    <span className="text-2xl font-bold text-teal-300 mt-1 block">
                      {statusBreakdown.on_track || 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-center">
                    <span className="text-xs font-medium text-amber-400 block uppercase">
                      At Risk
                    </span>
                    <span className="text-2xl font-bold text-amber-300 mt-1 block">
                      {statusBreakdown.at_risk || 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 text-center">
                    <span className="text-xs font-medium text-rose-400 block uppercase">
                      Behind
                    </span>
                    <span className="text-2xl font-bold text-rose-300 mt-1 block">
                      {statusBreakdown.behind || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Strategic Pillar Distribution */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-semibold text-white">
                      Strategic Pillar Distribution
                    </h2>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {pillars.map((pillar) => (
                    <div key={pillar.name}>
                      <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                        <span>{pillar.name}</span>
                        <span>
                          {pillar.alignedCount} items ({pillar.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, pillar.percentage)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Grid: Misalignment Diagnostics & Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Misalignment Diagnostics */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl lg:col-span-2 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-semibold text-white">
                      Misalignment Diagnostics
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Unmapped Decisions
                    </span>
                    <p className="text-xl font-bold text-white">
                      {diagnostics.unmappedDecisions || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Unmapped Action Items
                    </span>
                    <p className="text-xl font-bold text-white">
                      {diagnostics.unmappedActionItems || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Unaligned Ratio
                    </span>
                    <p className="text-xl font-bold text-amber-400">
                      {diagnostics.unalignedPercentage || 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-4">
                  <Shield className="w-5 h-5 text-teal-400" />
                  <h2 className="text-lg font-semibold text-white">
                    Strategic Recommendations
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

export default EnterpriseOkrAlignmentTelemetry;
