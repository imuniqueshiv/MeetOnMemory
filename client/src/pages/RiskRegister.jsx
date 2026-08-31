import React, { useState, useEffect, useContext } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import meetingRiskApi from "../services/meetingRiskApi";
import { organizationApi } from "../services/organizationApi";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import { useRBAC } from "../hooks/useRBAC.js";
import {
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Clock,
  Search,
  Filter,
  Users,
  Settings,
  PlusCircle,
  Activity,
  FileText,
  User,
} from "lucide-react";
import { toast } from "react-toastify";

const RiskRegister = () => {
  const { orgId } = useAuth();
  const { userData } = useContext(AppContent);
  const [risks, setRisks] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedCell, setSelectedCell] = useState(null); // { p, i }
  const [activeView, setActiveView] = useState("matrix"); // "matrix" | "escalations"

  // Mitigation modal state
  const [showMitigateModal, setShowMitigateModal] = useState(false);
  const [activeMitigateRisk, setActiveMitigateRisk] = useState(null);
  const [mitigationPlan, setMitigationPlan] = useState("");
  const [mitigationOwnerId, setMitigationOwnerId] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [mitigationLoadingSubmit, setMitigationLoadingSubmit] = useState(false);

  const { hasPermission } = useRBAC();
  const isAdminOrOwner = hasPermission("admin_panel", "manage");

  const effectiveOrgId =
    orgId ||
    userData?.currentOrganization?._id ||
    userData?.currentOrganization ||
    userData?.organization;

  useEffect(() => {
    fetchDashboardData();
    fetchMembers();
  }, [effectiveOrgId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await meetingRiskApi.getRiskDashboard();
      if (data.success) {
        setRisks(data.data.risks || []);
        setEscalations(data.data.escalations || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load risk dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await organizationApi.getMembers();
      if (response.data?.success) {
        const membersData = response.data.data || response.data.members || [];
        setUsersList(membersData.map((m) => m.user || m));
      }
    } catch (err) {
      console.error("Failed to load organization members", err);
    }
  };

  const handleMitigateSubmit = async (e) => {
    e.preventDefault();
    if (!mitigationPlan.trim()) {
      toast.error("Please enter a mitigation plan");
      return;
    }

    try {
      setMitigationLoadingSubmit(true);
      const response = await meetingRiskApi.mitigateRisk(
        activeMitigateRisk._id,
        {
          mitigationPlan,
          ownerId: mitigationOwnerId || null,
        },
      );

      if (response.success) {
        toast.success("Mitigation plan attached successfully");
        setShowMitigateModal(false);
        setActiveMitigateRisk(null);
        setMitigationPlan("");
        setMitigationOwnerId("");
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Failed to attach mitigation plan",
      );
    } finally {
      setMitigationLoadingSubmit(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await meetingRiskApi.exportRisks(orgId, "csv");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "risk-register.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export risks");
    }
  };

  const categories = [
    "All",
    "Technical",
    "Schedule",
    "Financial",
    "Resource",
    "Operational",
    "Compliance",
    "Other",
  ];

  const getRiskColor = (score) => {
    if (score >= 15) return "bg-rose-500 text-white";
    if (score >= 10) return "bg-orange-500 text-white";
    if (score >= 5) return "bg-amber-400 text-slate-900";
    return "bg-emerald-400 text-slate-900";
  };

  const getRiskLevel = (score) => {
    if (score >= 15) return "Critical";
    if (score >= 10) return "High";
    if (score >= 5) return "Medium";
    return "Low";
  };

  const filteredRisks = risks.filter((risk) => {
    const riskName = risk.title || risk.riskTitle || "";
    const riskDesc = risk.description || "";
    const matchesSearch =
      riskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      riskDesc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === "All" || risk.category === filterCategory;
    const matchesCell = selectedCell
      ? risk.probability === selectedCell.p && risk.impact === selectedCell.i
      : true;
    return matchesSearch && matchesCategory && matchesCell;
  });

  // Calculate Heatmap data
  const heatmap = Array(5)
    .fill(0)
    .map(() => Array(5).fill(0));
  risks.forEach((risk) => {
    const p = Math.min(5, Math.max(1, risk.probability)) - 1;
    const i = Math.min(5, Math.max(1, risk.impact)) - 1;
    heatmap[p][i]++;
  });

  const totalRisks = risks.length;
  const criticalRisks = risks.filter((r) => r.riskScore >= 15).length;
  const mitigatedRisks = risks.filter(
    (r) => r.status === "Mitigated" || r.status === "Closed",
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <Navbar />
      <div className="max-w-7xl mx-auto w-full pt-28 pb-20 px-6 space-y-8 flex-grow">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              Risk Management Matrix
            </h1>
            <p className="text-slate-400 mt-2 text-lg">
              Proactively identify, mitigate, and audit meeting risks.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors border border-slate-800 shadow-sm flex items-center gap-2"
            >
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={risks.length === 0}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors border border-slate-800 shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex border-b border-slate-800 gap-4">
          <button
            onClick={() => setActiveView("matrix")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeView === "matrix"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            Risk Register Matrix
          </button>
          {isAdminOrOwner && (
            <button
              onClick={() => setActiveView("escalations")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeView === "escalations"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
              data-testid="escalations-tab-btn"
            >
              <Clock className="w-4 h-4 text-orange-400 animate-pulse" />
              SLA Escalation Trails
              {escalations.length > 0 && (
                <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full border border-orange-500/30">
                  {escalations.length}
                </span>
              )}
            </button>
          )}
        </div>

        {activeView === "matrix" ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md shadow-xl hover:bg-slate-900/75 transition duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity text-blue-400">
                  <ShieldAlert size={48} />
                </div>
                <p className="text-slate-400 font-medium mb-1">
                  Total Active Risks
                </p>
                <h2 className="text-4xl font-bold text-white">{totalRisks}</h2>
              </div>
              <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-950/20 to-rose-900/10 border border-rose-500/20 backdrop-blur-md shadow-xl hover:from-rose-950/30 transition duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity text-rose-500">
                  <AlertTriangle size={48} />
                </div>
                <p className="text-rose-300 font-medium mb-1">Critical Risks</p>
                <h2 className="text-4xl font-bold text-rose-100">
                  {criticalRisks}
                </h2>
              </div>
              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-emerald-900/10 border border-emerald-500/20 backdrop-blur-md shadow-xl hover:from-emerald-950/30 transition duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity text-emerald-500">
                  <TrendingDown size={48} />
                </div>
                <p className="text-emerald-300 font-medium mb-1">
                  Mitigated/Closed
                </p>
                <h2 className="text-4xl font-bold text-emerald-100">
                  {mitigatedRisks}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Heatmap Section */}
              <div className="lg:col-span-1 space-y-4">
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl backdrop-blur-sm">
                  <h3 className="text-xl font-bold text-slate-200 mb-6 flex items-center justify-between">
                    <span>Risk Heatmap</span>
                    {selectedCell && (
                      <button
                        onClick={() => setSelectedCell(null)}
                        className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors"
                      >
                        Clear Filter
                      </button>
                    )}
                  </h3>

                  <div className="flex flex-col items-center">
                    {/* Y Axis Label */}
                    <div className="flex w-full mb-2">
                      <div className="w-6 flex items-center justify-center -rotate-90 text-xs text-slate-500 font-semibold uppercase tracking-wider transform -translate-x-4">
                        Probability
                      </div>

                      <div className="flex-1 grid grid-rows-5 gap-1">
                        {[5, 4, 3, 2, 1].map((p) => (
                          <div key={p} className="flex h-12 gap-1">
                            <div className="w-4 flex items-center justify-end pr-2 text-xs text-slate-500">
                              {p}
                            </div>
                            {[1, 2, 3, 4, 5].map((i) => {
                              const count = heatmap[p - 1][i - 1];
                              const score = p * i;
                              const bgClass =
                                score >= 15
                                  ? "bg-rose-500"
                                  : score >= 10
                                    ? "bg-orange-500"
                                    : score >= 5
                                      ? "bg-amber-400"
                                      : "bg-emerald-400";
                              const opacity =
                                count > 0 ? "opacity-100" : "opacity-20";
                              const isSelected =
                                selectedCell?.p === p && selectedCell?.i === i;

                              return (
                                <button
                                  key={`${p}-${i}`}
                                  onClick={() =>
                                    setSelectedCell(
                                      isSelected ? null : { p, i },
                                    )
                                  }
                                  className={`flex-1 rounded-md transition-all duration-300 flex items-center justify-center text-sm font-bold ${bgClass} ${opacity} hover:opacity-100 hover:scale-105 ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105 opacity-100 z-10" : ""}`}
                                  title={`Prob: ${p}, Impact: ${i} (Score: ${score}) - ${count} risks`}
                                >
                                  {count > 0 ? count : ""}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* X Axis Label */}
                    <div className="w-full flex pl-10">
                      <div className="flex-1 grid grid-cols-5 gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className="text-center text-xs text-slate-500 pt-1"
                          >
                            {i}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="w-full text-center text-xs text-slate-500 font-semibold uppercase tracking-wider mt-2 pl-10">
                      Impact
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Section */}
              <div className="lg:col-span-2 space-y-4">
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl backdrop-blur-sm min-h-[500px] flex flex-col">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 className="text-xl font-bold text-slate-200">
                      Risk Details
                    </h3>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                          size={16}
                        />
                        <input
                          type="text"
                          placeholder="Search risks..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div className="relative">
                        <Filter
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                          size={16}
                        />
                        <select
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex-grow overflow-auto rounded-xl border border-slate-800/50 bg-slate-950/50">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800">
                          <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Title / Meeting
                          </th>
                          <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
                            P / I
                          </th>
                          <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                          <tr>
                            <td
                              colSpan="6"
                              className="p-8 text-center text-slate-500"
                            >
                              Loading risks...
                            </td>
                          </tr>
                        ) : filteredRisks.length === 0 ? (
                          <tr>
                            <td
                              colSpan="6"
                              className="p-12 text-center text-slate-500 flex flex-col items-center"
                            >
                              <ShieldAlert
                                size={32}
                                className="mb-3 opacity-20"
                              />
                              <p>No risks found matching your criteria.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredRisks.map((risk) => (
                            <tr
                              key={risk._id}
                              className="hover:bg-slate-800/30 transition-colors group"
                            >
                              <td className="p-4">
                                <div className="font-medium text-slate-200 truncate max-w-[200px] xl:max-w-[300px]">
                                  {risk.title ||
                                    risk.riskTitle ||
                                    "Untitled Risk"}
                                </div>
                                <div className="text-xs text-slate-500 truncate max-w-[200px] xl:max-w-[300px] mt-1 flex items-center gap-1">
                                  {risk.meetingId?.title || "Unknown Meeting"}
                                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link
                                      to={`/meetings/${risk.meetingId?._id}`}
                                      className="text-blue-400 hover:underline"
                                    >
                                      View
                                    </Link>
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-800 text-slate-300">
                                  {risk.category}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="text-sm font-medium text-slate-300">
                                  {risk.probability}{" "}
                                  <span className="text-slate-600">×</span>{" "}
                                  {risk.impact}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getRiskColor(risk.riskScore ?? risk.probability * risk.impact)}`}
                                  >
                                    {risk.riskScore ??
                                      risk.probability * risk.impact}
                                  </span>
                                  <span className="text-xs font-medium text-slate-400">
                                    {getRiskLevel(
                                      risk.riskScore ??
                                        risk.probability * risk.impact,
                                    )}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    risk.status === "Mitigated"
                                      ? "bg-emerald-950/50 text-emerald-400 border-emerald-500/20"
                                      : risk.status === "Closed"
                                        ? "bg-slate-800 text-slate-400 border-slate-700"
                                        : risk.status === "Realized"
                                          ? "bg-rose-950/50 text-rose-400 border-rose-500/20"
                                          : "bg-blue-950/50 text-blue-400 border-blue-500/20"
                                  }`}
                                >
                                  {risk.status}
                                </span>
                              </td>
                              <td className="p-4">
                                {risk.status === "Open" ? (
                                  isAdminOrOwner ? (
                                    <button
                                      onClick={() => {
                                        setActiveMitigateRisk(risk);
                                        setMitigationPlan(
                                          risk.mitigationPlan || "",
                                        );
                                        setMitigationOwnerId(
                                          risk.ownerId?._id ||
                                            risk.ownerId ||
                                            "",
                                        );
                                        setShowMitigateModal(true);
                                      }}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors shadow-md"
                                      data-testid={`mitigate-btn-${risk._id}`}
                                    >
                                      Mitigate
                                    </button>
                                  ) : (
                                    <span className="text-xs text-slate-500 italic">
                                      Open
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <TrendingDown className="w-3.5 h-3.5" />
                                    Mitigated
                                  </span>
                                )}
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
          </>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              Risk Mitigation SLA Escalation Log
            </h2>

            <div className="overflow-x-auto rounded-xl border border-slate-800/50 bg-slate-950/50">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800">
                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Escalated At
                    </th>
                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Risk / Score
                    </th>
                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Reason for Escalation
                    </th>
                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="p-8 text-center text-slate-500"
                      >
                        Loading logs...
                      </td>
                    </tr>
                  ) : escalations.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="p-12 text-center text-slate-500"
                      >
                        No escalations logged. All risks are fully compliant.
                      </td>
                    </tr>
                  ) : (
                    escalations.map((esc) => (
                      <tr key={esc._id} className="hover:bg-slate-800/20">
                        <td className="p-4 text-sm text-slate-400">
                          {new Date(esc.escalatedAt).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-200">
                            {esc.riskId?.title || "Deleted Risk"}
                          </div>
                          {esc.riskId && (
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${getRiskColor(esc.riskId.riskScore)}`}
                              >
                                {esc.riskId.riskScore}
                              </span>
                              <span className="text-xs text-slate-400">
                                {getRiskLevel(esc.riskId.riskScore)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-sm text-rose-300/90 whitespace-pre-wrap max-w-md">
                          {esc.reason}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                            Escalated
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Mitigation Modal */}
      {showMitigateModal && activeMitigateRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative"
            data-testid="mitigation-plan-modal"
          >
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-500" />
              Mitigate Flagged Risk
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Create a structured mitigation plan. Attaching a plan moves the
              risk to <strong>Mitigated</strong> status.
            </p>

            <form onSubmit={handleMitigateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Risk
                </label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 font-medium">
                  {activeMitigateRisk.title}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Mitigation Plan Description *
                </label>
                <textarea
                  rows="4"
                  value={mitigationPlan}
                  onChange={(e) => setMitigationPlan(e.target.value)}
                  placeholder="Describe details of the mitigation plan..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Mitigation Owner
                </label>
                <select
                  value={mitigationOwnerId}
                  onChange={(e) => setMitigationOwnerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
                >
                  <option value="">Select a mitigation owner...</option>
                  {usersList.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name ||
                        `${user.firstName || ""} ${user.lastName || ""}`}{" "}
                      ({user.email || "No Email"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setShowMitigateModal(false);
                    setActiveMitigateRisk(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mitigationLoadingSubmit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {mitigationLoadingSubmit ? "Saving Plan..." : "Attach Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskRegister;
