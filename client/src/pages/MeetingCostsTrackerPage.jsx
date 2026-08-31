import React, { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { meetingApi } from "../services/meetingApi.js";
import {
  DEFAULT_AVG_SALARY,
  getHourlyRate,
  enrichMeetingCostData,
  calculateTeamMetrics,
  filterAndSortMeetings,
  generateCostRecommendations,
} from "../utils/meetingCostTrackerUtils.js";
import {
  DollarSign,
  Clock,
  Users,
  TrendingDown,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Briefcase,
  PieChart as PieIcon,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DEFAULT_SAMPLE_MEETINGS = [
  {
    _id: "m-1",
    title: "Weekly Engineering All-Hands",
    team: "Engineering",
    participantsCount: 8,
    durationMinutes: 60,
    frequency: "weekly",
  },
  {
    _id: "m-2",
    title: "Daily Product & Dev Standup",
    team: "Engineering",
    participantsCount: 5,
    durationMinutes: 30,
    frequency: "daily",
  },
  {
    _id: "m-3",
    title: "Product Roadmap Planning",
    team: "Product",
    participantsCount: 10,
    durationMinutes: 90,
    frequency: "monthly",
  },
  {
    _id: "m-4",
    title: "UI/UX Design Critique",
    team: "Design",
    participantsCount: 4,
    durationMinutes: 45,
    frequency: "weekly",
  },
  {
    _id: "m-5",
    title: "Sales Pipeline Review",
    team: "Sales",
    participantsCount: 6,
    durationMinutes: 60,
    frequency: "weekly",
  },
  {
    _id: "m-6",
    title: "Marketing Campaign Alignment",
    team: "Marketing",
    participantsCount: 5,
    durationMinutes: 45,
    frequency: "bi-weekly",
  },
];

const MeetingCostsTrackerPage = () => {
  const [avgSalary, setAvgSalary] = useState(DEFAULT_AVG_SALARY);
  const [rawMeetings, setRawMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [sortBy, setSortBy] = useState("cost");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchMeetingsData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await meetingApi.getAllMeetings();
      const meetingsList =
        res?.data?.meetings || res?.data || res?.meetings || [];
      if (Array.isArray(meetingsList) && meetingsList.length > 0) {
        setRawMeetings(meetingsList);
      } else {
        setRawMeetings(DEFAULT_SAMPLE_MEETINGS);
      }
    } catch (err) {
      console.warn(
        "Could not load API meetings, falling back to sample dataset:",
        err,
      );
      setRawMeetings(DEFAULT_SAMPLE_MEETINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetingsData();
  }, [fetchMeetingsData]);

  // Derived calculations
  const hourlyRate = useMemo(() => getHourlyRate(avgSalary), [avgSalary]);

  const enrichedMeetings = useMemo(() => {
    return (rawMeetings.length > 0 ? rawMeetings : DEFAULT_SAMPLE_MEETINGS).map(
      (m) => enrichMeetingCostData(m, avgSalary),
    );
  }, [rawMeetings, avgSalary]);

  const teamList = useMemo(() => {
    const teams = new Set(enrichedMeetings.map((m) => m.team));
    return ["all", ...Array.from(teams).sort()];
  }, [enrichedMeetings]);

  const filteredAndSortedMeetings = useMemo(() => {
    return filterAndSortMeetings(
      enrichedMeetings,
      selectedTeam,
      sortBy,
      sortOrder,
      avgSalary,
    );
  }, [enrichedMeetings, selectedTeam, sortBy, sortOrder, avgSalary]);

  const kpis = useMemo(() => {
    const totalMonthlyCost = enrichedMeetings.reduce(
      (sum, m) => sum + m.monthlyCost,
      0,
    );
    const totalPersonHours = enrichedMeetings.reduce(
      (sum, m) => sum + m.personHours,
      0,
    );
    const avgCostPerMeeting =
      enrichedMeetings.length > 0
        ? totalMonthlyCost / enrichedMeetings.length
        : 0;

    return {
      totalMonthlyCost,
      totalPersonHours,
      avgCostPerMeeting,
    };
  }, [enrichedMeetings]);

  const teamMetrics = useMemo(() => {
    return calculateTeamMetrics(enrichedMeetings, {}, avgSalary);
  }, [enrichedMeetings, avgSalary]);

  const recommendations = useMemo(() => {
    return generateCostRecommendations(
      enrichedMeetings,
      teamMetrics,
      avgSalary,
    );
  }, [enrichedMeetings, teamMetrics, avgSalary]);

  const totalAnnualSavings = useMemo(() => {
    return recommendations.reduce((sum, r) => sum + r.annualSavings, 0);
  }, [recommendations]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const getEffortBadgeClass = (effort) => {
    switch (String(effort).toLowerCase()) {
      case "low":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "medium":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "high":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <DollarSign className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Meeting Cost Tracker
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Real-time financial analysis, team-based spend tracking, and
                actionable savings recommendations.
              </p>
            </div>
          </div>

          {/* Salary Settings Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <label
                htmlFor="avg-salary-input"
                className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Avg Team Salary ($/mo):
              </label>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">
                $
              </span>
              <input
                id="avg-salary-input"
                type="number"
                min="1000"
                step="500"
                value={avgSalary}
                onChange={(e) =>
                  setAvgSalary(Number(e.target.value) || DEFAULT_AVG_SALARY)
                }
                className="w-28 pl-6 pr-2 py-1 text-sm font-semibold rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Hourly Rate:{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                ${hourlyRate.toFixed(2)}/hr
              </span>
            </div>
            <button
              onClick={fetchMeetingsData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Refresh meeting data"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Monthly Meeting Cost */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Monthly Meeting Cost
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(kpis.totalMonthlyCost)}
              </span>
              <span className="text-xs text-gray-400">/mo</span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Across {enrichedMeetings.length} active meeting agendas
            </p>
          </div>

          {/* Total Person-Hours */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total Person-Hours
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {kpis.totalPersonHours.toFixed(1)}
              </span>
              <span className="text-xs text-gray-400">hrs/mo</span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Monthly workforce time investment
            </p>
          </div>

          {/* Average Cost Per Meeting */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Avg Cost / Meeting
              </span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {formatCurrency(kpis.avgCostPerMeeting)}
              </span>
              <span className="text-xs text-gray-400">/session</span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Based on duration & headcount
            </p>
          </div>

          {/* Potential Annual Savings */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Projected Annual Savings
              </span>
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-teal-600 dark:text-teal-400">
                {formatCurrency(totalAnnualSavings)}
              </span>
              <span className="text-xs text-gray-400">/yr</span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Identified via cost optimizations
            </p>
          </div>
        </div>

        {/* Meeting Breakdown & Filtering Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-500" />
                Meeting Cost Breakdown
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Real-time financial evaluation of individual team meetings.
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter by Team */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Team:
                </span>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-800 dark:text-gray-200 outline-none"
                >
                  {teamList.map((t) => (
                    <option
                      key={t}
                      value={t}
                      className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                    >
                      {t === "all" ? "All Teams" : t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-800 dark:text-gray-200 outline-none"
                >
                  <option value="cost" className="bg-white dark:bg-gray-900">
                    Cost (Monthly)
                  </option>
                  <option
                    value="participants"
                    className="bg-white dark:bg-gray-900"
                  >
                    Participants
                  </option>
                  <option
                    value="duration"
                    className="bg-white dark:bg-gray-900"
                  >
                    Duration
                  </option>
                  <option
                    value="frequency"
                    className="bg-white dark:bg-gray-900"
                  >
                    Frequency
                  </option>
                </select>
              </div>

              {/* Order Toggle */}
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {sortOrder === "desc" ? "High to Low ↓" : "Low to High ↑"}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3 px-4">Meeting Title</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">Participants</th>
                  <th className="py-3 px-4 text-center">Duration</th>
                  <th className="py-3 px-4 text-center">Frequency</th>
                  <th className="py-3 px-4 text-right">Hourly Rate</th>
                  <th className="py-3 px-4 text-right">Cost / Meeting</th>
                  <th className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    Monthly Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                {filteredAndSortedMeetings.map((m) => (
                  <tr
                    key={m._id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-gray-100">
                      {m.title}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        {m.team}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-700 dark:text-gray-300">
                      {m.participantsCount} members
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-700 dark:text-gray-300">
                      {m.durationMinutes} mins
                    </td>
                    <td className="py-3.5 px-4 text-center capitalize text-gray-700 dark:text-gray-300">
                      {m.frequency}
                    </td>
                    <td className="py-3.5 px-4 text-right text-gray-600 dark:text-gray-400">
                      ${m.hourlyRate.toFixed(2)}/hr
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-gray-800 dark:text-gray-200">
                      {formatCurrency(m.singleCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(m.monthlyCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team-Based Cost Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Monthly Cost by Team */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Monthly Spend by Team
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={teamMetrics}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    opacity={0.2}
                  />
                  <XAxis
                    dataKey="teamName"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                  <Bar
                    dataKey="totalMonthlyCost"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    name="Monthly Cost ($)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Cost Per Member */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-purple-500" />
              Cost Per Team Member ($/mo)
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={teamMetrics}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    opacity={0.2}
                  />
                  <XAxis
                    dataKey="teamName"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                  <Bar
                    dataKey="costPerMember"
                    fill="#8b5cf6"
                    radius={[6, 6, 0, 0]}
                    name="Cost / Member ($)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Team Details Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Team Financial Summary
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3 px-4">Team Name</th>
                  <th className="py-3 px-4 text-center">Active Meetings</th>
                  <th className="py-3 px-4 text-center">Est. Members</th>
                  <th className="py-3 px-4 text-center">Hourly Rate</th>
                  <th className="py-3 px-4 text-right">Person-Hours</th>
                  <th className="py-3 px-4 text-right">Cost / Member</th>
                  <th className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    Total Monthly Spend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                {teamMetrics.map((t) => (
                  <tr
                    key={t.teamName}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-gray-100">
                      {t.teamName}
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-700 dark:text-gray-300">
                      {t.meetingCount}
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-700 dark:text-gray-300">
                      {t.memberCount}
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-600 dark:text-gray-400">
                      ${t.hourlyRate.toFixed(2)}/hr
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-gray-800 dark:text-gray-200">
                      {t.totalPersonHours.toFixed(1)} hrs
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-purple-600 dark:text-purple-400">
                      {formatCurrency(t.costPerMember)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(t.totalMonthlyCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actionable Recommendations with Effort Levels */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-500" />
                Actionable Cost-Saving Recommendations
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Optimizations categorized by implementation effort to maximize
                return on time.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 dark:text-gray-400 block">
                Total Potential Annual Savings
              </span>
              <span className="text-xl font-extrabold text-teal-600 dark:text-teal-400">
                {formatCurrency(totalAnnualSavings)}/yr
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getEffortBadgeClass(
                        rec.effort,
                      )}`}
                    >
                      Effort: {rec.effort}
                    </span>
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                      +{formatCurrency(rec.annualSavings)}/yr
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    {rec.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {rec.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Monthly impact:{" "}
                    <strong className="text-gray-800 dark:text-gray-200">
                      +{formatCurrency(rec.monthlySavings)}
                    </strong>
                  </span>
                  <button className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    {rec.actionText} →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MeetingCostsTrackerPage;
