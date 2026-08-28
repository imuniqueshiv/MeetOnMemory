import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { getEnterpriseCostResourceEngine } from "../services/meetingCostApi.js";
import { toast } from "react-toastify";
import {
  DollarSign,
  TrendingDown,
  Clock,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  Loader2,
  PieChart,
  Zap,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Layers,
} from "lucide-react";

const TIMEFRAMES = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "1 Year", value: "1y" },
  { label: "All Time", value: "all" },
];

const EnterpriseMeetingCostEngine = () => {
  const [timeframe, setTimeframe] = useState("30d");
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEnterpriseCostResourceEngine(timeframe);
      if (res.success && res.telemetry) {
        setTelemetry(res.telemetry);
      } else {
        const msg =
          res.message || "Failed to load meeting cost engine telemetry";
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error("Fetch cost engine error:", err);
      const errMsg =
        err.response?.data?.message || "Error fetching meeting cost telemetry";
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
  const efficiency = telemetry?.efficiencyMetrics || {};
  const savings = telemetry?.savingsOpportunities || {};
  const recommendations = savings.recommendations || [];
  const currency = telemetry?.currency || "USD";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-lg shadow-emerald-500/20">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Enterprise Meeting Cost & Resource Engine
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Holistic financial analysis of workforce time investment,
                  resource booking expenditures, and cost efficiency.
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
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
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
              title="Refresh cost telemetry"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm font-medium">
              Computing financial cost engine metrics...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-200 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-rose-300">
                Unable to load meeting cost telemetry
              </h3>
              <p className="text-xs text-rose-400 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Financial Investment */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Investment
                  </span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-emerald-400">
                    ${(summary.totalFinancialInvestment || 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">{currency}</span>
                </div>
                <div className="mt-2 text-xs text-slate-400 flex items-center gap-3">
                  <span>${summary.laborTimeCost || 0} Labor</span>
                  <span>•</span>
                  <span>${summary.resourceBookingCost || 0} Rooms</span>
                </div>
              </div>

              {/* Total Hours Spent */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Hours Spent
                  </span>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    {summary.totalHoursSpent || 0}
                  </span>
                  <span className="text-xs text-slate-400">hours</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Across {summary.totalMeetingsCount || 0} meetings
                </div>
              </div>

              {/* Meeting Waste Score */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Meeting Waste Score
                  </span>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-extrabold ${
                      (summary.meetingWasteScore || 0) > 40
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {summary.meetingWasteScore || 0}
                  </span>
                  <span className="text-xs text-slate-400">/ 100</span>
                </div>
                <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (summary.meetingWasteScore || 0) > 40
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(100, summary.meetingWasteScore || 0)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Potential Savings */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Potential Savings
                  </span>
                  <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-teal-300">
                    ${(savings.potentialLaborSavings || 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">identifiable</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Via meeting duration optimization
                </div>
              </div>
            </div>

            {/* Efficiency Metrics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Financial Efficiency per Outcome */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <PieChart className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-lg font-semibold text-white">
                      Outcome Financial Efficiency
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Cost per Decision Reached
                    </span>
                    <p className="text-2xl font-bold text-emerald-400">
                      ${efficiency.costPerDecision || 0}
                    </p>
                    <span className="text-[10px] text-slate-500 block">
                      Across {efficiency.totalDecisionsCount || 0} decisions
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Cost per Action Item
                    </span>
                    <p className="text-2xl font-bold text-teal-400">
                      ${efficiency.costPerActionItem || 0}
                    </p>
                    <span className="text-[10px] text-slate-500 block">
                      Across {efficiency.totalActionItemsCount || 0} action
                      items
                    </span>
                  </div>
                </div>
              </div>

              {/* Resource Utilization */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-semibold text-white">
                      Physical Resource Utilization
                    </h2>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                      <span>Room & Hardware Booking Rate</span>
                      <span>{efficiency.resourceUtilizationRate || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, efficiency.resourceUtilizationRate || 0)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">
                      Low-Yield Meeting Count
                    </span>
                    <p className="text-xl font-bold text-amber-400">
                      {savings.lowYieldMeetingCount || 0} meetings
                    </p>
                    <span className="text-[10px] text-slate-500 block">
                      Meetings &ge; 45 mins with 0 decision/action tagging
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings & Recommendations Section */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">
                  Strategic Savings Recommendations
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </>
        )}
      </main>
    </div>
  );
};

export default EnterpriseMeetingCostEngine;
