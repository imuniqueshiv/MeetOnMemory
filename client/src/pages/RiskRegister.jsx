import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import meetingRiskApi from "../services/meetingRiskApi";
import {
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "react-toastify";

const RiskRegister = () => {
  const { orgId } = useAuth();
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedCell, setSelectedCell] = useState(null); // { p, i }

  useEffect(() => {
    if (orgId) {
      fetchRisks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchRisks = async () => {
    try {
      setLoading(true);
      const data = await meetingRiskApi.getRisksByOrganization(orgId);
      if (data.success) {
        setRisks(data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load risks");
    } finally {
      setLoading(false);
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
    const matchesSearch =
      risk.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      risk.description?.toLowerCase().includes(searchTerm.toLowerCase());
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
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              Risk Register
            </h1>
            <p className="text-slate-400 mt-2 text-lg">
              Proactively monitor and manage organizational meeting risks.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchRisks}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-700 shadow-sm flex items-center gap-2"
            >
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={risks.length === 0}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-700 shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 transition duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
              <ShieldAlert size={48} />
            </div>
            <p className="text-slate-400 font-medium mb-1">
              Total Active Risks
            </p>
            <h2 className="text-4xl font-bold text-white">{totalRisks}</h2>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-900/40 to-rose-950/40 border border-rose-500/20 backdrop-blur-md shadow-xl hover:from-rose-900/50 hover:to-rose-950/50 transition duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity text-rose-500">
              <AlertTriangle size={48} />
            </div>
            <p className="text-rose-300 font-medium mb-1">Critical Risks</p>
            <h2 className="text-4xl font-bold text-rose-100">
              {criticalRisks}
            </h2>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border border-emerald-500/20 backdrop-blur-md shadow-xl hover:from-emerald-900/50 hover:to-emerald-950/50 transition duration-300 relative overflow-hidden group">
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
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
              <h3 className="text-xl font-bold text-slate-200 mb-6 flex items-center gap-2">
                Risk Heatmap
                {selectedCell && (
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="text-xs px-2 py-1 bg-slate-800 rounded-md text-slate-400 hover:text-white"
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
                                setSelectedCell(isSelected ? null : { p, i })
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
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm min-h-[500px] flex flex-col">
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

              <div className="flex-1 overflow-auto rounded-xl border border-slate-800/50 bg-slate-950/50">
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {loading ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="p-8 text-center text-slate-500"
                        >
                          Loading risks...
                        </td>
                      </tr>
                    ) : filteredRisks.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="p-12 text-center text-slate-500 flex flex-col items-center"
                        >
                          <ShieldAlert size={32} className="mb-3 opacity-20" />
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
                              {risk.title}
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
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getRiskColor(risk.riskScore)}`}
                              >
                                {risk.riskScore}
                              </span>
                              <span className="text-xs font-medium text-slate-400">
                                {getRiskLevel(risk.riskScore)}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskRegister;
