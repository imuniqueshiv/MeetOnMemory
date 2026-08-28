import React, { useContext, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Smile,
  Meh,
  Frown,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Building2,
  RefreshCw,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Navbar from "../components/Navbar";
import AppContent from "../context/AppContent";
import { organizationApi, sentimentTimelineApi } from "../services";
import { toast } from "react-toastify";
import { format } from "date-fns";

const SentimentTrends = () => {
  const { userData } = useContext(AppContent) || {};
  const initialOrgId =
    (typeof userData?.organization === "object"
      ? userData?.organization?._id
      : userData?.organization) || "";
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(initialOrgId);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Fetch user organizations
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const { data: orgData } = await organizationApi.getUserOrganizations();
        if (orgData.success) {
          const list = orgData.organizations || [];
          setOrganizations(list);
          if (!selectedOrgId && list[0]?._id) {
            setSelectedOrgId(list[0]._id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch organizations:", err);
      }
    };
    fetchOrgs();
  }, [selectedOrgId]);

  // Fetch sentiment trends
  const fetchTrends = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      setLoading(true);
      const res = await sentimentTimelineApi.getOrgTrends(selectedOrgId, {
        days,
      });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching sentiment trends:", err);
      toast.error("Failed to load organization sentiment trends");
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, days]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const summary = data?.summary || {
    averageScore: 0,
    totalMeetingsAnalyzed: 0,
    totalSegmentsAnalyzed: 0,
    positivePercent: 0,
    neutralPercent: 0,
    negativePercent: 0,
    trendDirection: "stable",
  };

  const timeline = data?.timeline || [];
  const highlights = data?.highlights || {};

  const getSentimentDetails = (score) => {
    if (score >= 0.25) {
      return {
        label: "Positive",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/30",
        icon: Smile,
      };
    }
    if (score <= -0.25) {
      return {
        label: "Negative",
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-500/10 border-rose-500/30",
        icon: Frown,
      };
    }
    return {
      label: "Neutral",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      icon: Meh,
    };
  };

  const scoreDetails = getSentimentDetails(summary.averageScore);
  const SentimentIcon = scoreDetails.icon;

  const currentOrg = organizations.find((o) => o._id === selectedOrgId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar />

      <main className="flex-grow container mx-auto px-4 pt-24 pb-16 max-w-7xl">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <BarChart3 className="w-3.5 h-3.5" />
                Intelligence &amp; Culture
              </span>
              {currentOrg && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  &bull; {currentOrg.name}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Organization Sentiment Trends
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
              Track collective tone, emotional trajectory, and cross-meeting
              sentiment shifts across your team discussions.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {organizations.length > 1 && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <Building2 className="w-4 h-4 text-gray-500" />
                <select
                  aria-label="Filter by Organization"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="text-xs bg-transparent border-0 font-medium text-gray-800 dark:text-gray-200 focus:ring-0 cursor-pointer outline-none"
                >
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Range Selector */}
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
              {[7, 30, 90, 180].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    days === d
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchTrends}
              disabled={loading}
              className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 shadow-sm transition-all"
              title="Refresh sentiment data"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`}
              />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Aggregating organization sentiment timelines...
            </p>
          </div>
        ) : timeline.length === 0 ? (
          /* Empty State */
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-12 text-center max-w-2xl mx-auto shadow-sm my-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-800">
              <Smile className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No Sentiment Timelines Yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Sentiment trends are automatically derived from meeting
              transcripts and AI summary timelines. Run meeting transcriptions
              to view emotional arcs and positivity trends.
            </p>
            <Link
              to="/meetings"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all"
            >
              Go to Meetings <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Average Sentiment Score */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Average Sentiment
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${scoreDetails.bg} ${scoreDetails.color}`}
                  >
                    <SentimentIcon className="w-3.5 h-3.5" />
                    {scoreDetails.label}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold">
                    {summary.averageScore > 0
                      ? `+${summary.averageScore}`
                      : summary.averageScore}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Scale from -1.0 (Critical) to +1.0 (Positive)
                  </p>
                </div>
              </div>

              {/* Card 2: Trend Direction */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Momentum
                  </span>
                  {summary.trendDirection === "improving" ? (
                    <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                  ) : summary.trendDirection === "declining" ? (
                    <span className="p-1 rounded-lg bg-rose-500/10 text-rose-500">
                      <TrendingDown className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="p-1 rounded-lg bg-gray-500/10 text-gray-400">
                      <Minus className="w-4 h-4" />
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold capitalize">
                    {summary.trendDirection}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Compared to previous {days}d period
                  </p>
                </div>
              </div>

              {/* Card 3: Positive Ratio */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Positive Segments
                  </span>
                  <span className="p-1 rounded-lg bg-blue-500/10 text-blue-500">
                    <Sparkles className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                    {summary.positivePercent}%
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {summary.neutralPercent}% Neutral &bull;{" "}
                    {summary.negativePercent}% Critical
                  </p>
                </div>
              </div>

              {/* Card 4: Analyzed Volume */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Meetings Analyzed
                  </span>
                  <span className="p-1 rounded-lg bg-purple-500/10 text-purple-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold">
                    {summary.totalMeetingsAnalyzed}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {summary.totalSegmentsAnalyzed} speech segments evaluated
                  </p>
                </div>
              </div>
            </div>

            {/* Distribution Breakdown Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <h2 className="text-base font-bold mb-3 flex items-center justify-between">
                <span>Sentiment Tone Distribution</span>
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  {summary.totalSegmentsAnalyzed} Total Speech Segments
                </span>
              </h2>

              <div className="w-full h-4 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${summary.positivePercent}%` }}
                  className="bg-emerald-500 h-full transition-all duration-700"
                  title={`Positive: ${summary.positivePercent}%`}
                />
                <div
                  style={{ width: `${summary.neutralPercent}%` }}
                  className="bg-amber-400 h-full transition-all duration-700"
                  title={`Neutral: ${summary.neutralPercent}%`}
                />
                <div
                  style={{ width: `${summary.negativePercent}%` }}
                  className="bg-rose-500 h-full transition-all duration-700"
                  title={`Negative: ${summary.negativePercent}%`}
                />
              </div>

              <div className="flex items-center justify-between mt-3 text-xs font-medium">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Positive ({summary.positivePercent}%)
                </div>
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Neutral ({summary.neutralPercent}%)
                </div>
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Constructive / Negative ({summary.negativePercent}%)
                </div>
              </div>
            </div>

            {/* Interactive Timeline Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Sentiment Trajectory Over Time
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Average sentiment score across sequential team meetings
                  </p>
                </div>
              </div>

              {/* SVG Line Chart */}
              <div className="relative w-full h-64 select-none">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 1000 240"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="sentimentGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                      <stop
                        offset="100%"
                        stopColor="#3b82f6"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {/* +1.0 Top */}
                  <line
                    x1="0"
                    y1="20"
                    x2="1000"
                    y2="20"
                    stroke="currentColor"
                    strokeOpacity="0.08"
                  />
                  {/* +0.5 */}
                  <line
                    x1="0"
                    y1="70"
                    x2="1000"
                    y2="70"
                    stroke="currentColor"
                    strokeOpacity="0.05"
                    strokeDasharray="4 4"
                  />
                  {/* 0.0 Center Baseline */}
                  <line
                    x1="0"
                    y1="120"
                    x2="1000"
                    y2="120"
                    stroke="currentColor"
                    strokeOpacity="0.2"
                  />
                  {/* -0.5 */}
                  <line
                    x1="0"
                    y1="170"
                    x2="1000"
                    y2="170"
                    stroke="currentColor"
                    strokeOpacity="0.05"
                    strokeDasharray="4 4"
                  />
                  {/* -1.0 Bottom */}
                  <line
                    x1="0"
                    y1="220"
                    x2="1000"
                    y2="220"
                    stroke="currentColor"
                    strokeOpacity="0.08"
                  />

                  {/* Chart Line Path */}
                  {timeline.length > 1 ? (
                    (() => {
                      const points = timeline.map((m, idx) => {
                        const x = (idx / (timeline.length - 1)) * 960 + 20;
                        // Map score from [-1, 1] to [220, 20]
                        const normalized = (m.averageScore + 1) / 2; // 0 to 1
                        const y = 220 - normalized * 200;
                        return { x, y, m, idx };
                      });

                      const pathD = points.reduce(
                        (acc, pt, i) =>
                          i === 0
                            ? `M ${pt.x} ${pt.y}`
                            : `${acc} L ${pt.x} ${pt.y}`,
                        "",
                      );

                      const areaD = `${pathD} L ${points[points.length - 1].x} 220 L ${points[0].x} 220 Z`;

                      return (
                        <g>
                          <path d={areaD} fill="url(#sentimentGradient)" />
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {points.map((pt) => {
                            const isSelected = hoveredPoint?.idx === pt.idx;
                            const isPositive = pt.m.averageScore > 0.1;
                            const isNegative = pt.m.averageScore < -0.1;
                            const dotColor = isPositive
                              ? "#10b981"
                              : isNegative
                                ? "#f43f5e"
                                : "#f59e0b";

                            return (
                              <g
                                key={pt.idx}
                                onMouseEnter={() => setHoveredPoint(pt)}
                                onMouseLeave={() => setHoveredPoint(null)}
                                className="cursor-pointer"
                              >
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={isSelected ? 7 : 5}
                                  fill={dotColor}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                  className="transition-all duration-200"
                                />
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()
                  ) : timeline.length === 1 ? (
                    <circle
                      cx="500"
                      cy={120 - timeline[0].averageScore * 100}
                      r="6"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  ) : null}
                </svg>

                {/* Hover Tooltip Overlay */}
                {hoveredPoint && (
                  <div
                    className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-3 py-2 rounded-xl shadow-xl border border-gray-700 dark:border-gray-200 text-xs"
                    style={{
                      left: `${(hoveredPoint.idx / (timeline.length - 1)) * 96 + 2}%`,
                      top: `${hoveredPoint.y - 12}px`,
                    }}
                  >
                    <div className="font-bold truncate max-w-xs">
                      {hoveredPoint.m.title}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Score:{" "}
                      <span className="font-semibold">
                        {hoveredPoint.m.averageScore > 0
                          ? `+${hoveredPoint.m.averageScore}`
                          : hoveredPoint.m.averageScore}
                      </span>{" "}
                      &bull;{" "}
                      {hoveredPoint.m.date
                        ? format(new Date(hoveredPoint.m.date), "MMM d")
                        : ""}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 px-2">
                <span>Earliest ({days}d window)</span>
                <span className="text-gray-400 dark:text-gray-500">
                  Center Baseline (0.0 Neutral)
                </span>
                <span>Latest</span>
              </div>
            </div>

            {/* Highlights Grid */}
            {(highlights.mostPositiveMeeting ||
              highlights.mostNegativeMeeting) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {highlights.mostPositiveMeeting && (
                  <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 rounded-2xl border border-emerald-500/30 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Smile className="w-4 h-4" /> Most Positive Session
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500 text-white">
                        +{highlights.mostPositiveMeeting.averageScore}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {highlights.mostPositiveMeeting.title}
                    </h3>
                    {highlights.mostPositiveMeeting.overallArc && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 italic leading-relaxed">
                        &ldquo;{highlights.mostPositiveMeeting.overallArc}
                        &rdquo;
                      </p>
                    )}
                    <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {highlights.mostPositiveMeeting.date
                          ? format(
                              new Date(highlights.mostPositiveMeeting.date),
                              "MMMM d, yyyy",
                            )
                          : ""}
                      </span>
                      <Link
                        to={`/meetings/${highlights.mostPositiveMeeting.meetingId}`}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        View Meeting <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}

                {highlights.mostNegativeMeeting && (
                  <div className="bg-gradient-to-br from-rose-500/5 to-rose-500/10 rounded-2xl border border-rose-500/30 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <Frown className="w-4 h-4" /> Most Critical /
                        Challenging Session
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-500 text-white">
                        {highlights.mostNegativeMeeting.averageScore}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {highlights.mostNegativeMeeting.title}
                    </h3>
                    {highlights.mostNegativeMeeting.overallArc && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 italic leading-relaxed">
                        &ldquo;{highlights.mostNegativeMeeting.overallArc}
                        &rdquo;
                      </p>
                    )}
                    <div className="mt-4 pt-3 border-t border-rose-500/20 flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {highlights.mostNegativeMeeting.date
                          ? format(
                              new Date(highlights.mostNegativeMeeting.date),
                              "MMMM d, yyyy",
                            )
                          : ""}
                      </span>
                      <Link
                        to={`/meetings/${highlights.mostNegativeMeeting.meetingId}`}
                        className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
                      >
                        View Meeting <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Meeting Sentiment Drilldown List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Meeting Sentiment Breakdown
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Individual meeting records with emotional arc summaries
                  </p>
                </div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {timeline.length} Sessions
                </span>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {timeline.map((item) => {
                  const itemDetails = getSentimentDetails(item.averageScore);
                  const ItemIcon = itemDetails.icon;

                  return (
                    <div
                      key={item.timelineId || item.meetingId}
                      className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/meetings/${item.meetingId}`}
                            className="text-base font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
                          >
                            {item.title}
                          </Link>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1 ${itemDetails.bg} ${itemDetails.color}`}
                          >
                            <ItemIcon className="w-3 h-3" />
                            {item.averageScore > 0
                              ? `+${item.averageScore}`
                              : item.averageScore}
                          </span>
                        </div>

                        {item.overallArc && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {item.overallArc}
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {item.date
                              ? format(new Date(item.date), "MMM d, yyyy")
                              : "N/A"}
                          </span>
                          {item.duration > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {item.duration} min
                            </span>
                          )}
                          <div className="flex items-center gap-2 font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {item.positiveCount} pos
                            </span>
                            &bull;
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {item.neutralCount} neut
                            </span>
                            &bull;
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              {item.negativeCount} neg
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Link
                          to={`/meetings/${item.meetingId}`}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-gray-700 dark:text-gray-300 transition-all inline-flex items-center gap-1"
                        >
                          Details <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SentimentTrends;
