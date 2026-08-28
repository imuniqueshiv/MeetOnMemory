import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { getDecisionDependencyMatrix } from "../services/decisionGraphApi.js";
import { toast } from "react-toastify";
import {
  Grid,
  RefreshCw,
  Loader2,
  AlertTriangle,
  GitCommit,
  CheckCircle2,
  HelpCircle,
  Search,
  Filter,
  ArrowRight,
  Layers,
  XCircle,
  X,
} from "lucide-react";

const STATUS_FILTERS = [
  { label: "All Statuses", value: "" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in-progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Superseded", value: "superseded" },
];

const DecisionDependencyMatrix = () => {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDecisionDependencyMatrix({
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setMatrixData(data);
    } catch (err) {
      console.error("Error fetching decision dependency matrix:", err);
      const msg =
        err.response?.data?.message ||
        "Failed to load decision dependency matrix";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const nodes = matrixData?.nodes || [];
  const grid = matrixData?.matrix || [];
  const summary = matrixData?.summary || {};
  const cycles = matrixData?.cycles || [];

  const getCellBadge = (cell) => {
    if (!cell || cell.type === "none") {
      return (
        <span className="text-slate-700 hover:text-slate-500 font-mono text-xs">
          •
        </span>
      );
    }
    if (cell.type === "self") {
      return (
        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-500 text-[10px] font-bold flex items-center justify-center border border-slate-700">
          \
        </span>
      );
    }
    if (cell.type === "relatesTo") {
      return (
        <span
          className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 text-[10px] font-semibold flex items-center gap-1 shadow-sm"
          title={`Relates To (${cell.confidence}% confidence)`}
        >
          <GitCommit className="w-3 h-3" />
          <span>relates</span>
        </span>
      );
    }
    if (cell.type === "supersededBy") {
      return (
        <span
          className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1 shadow-sm"
          title="Superseded By Target Decision"
        >
          <ArrowRight className="w-3 h-3" />
          <span>superseded</span>
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/20">
                <Grid className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Decision Dependency Matrix
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  2D cross-tabular visualization of decision relationships,
                  prerequisites, and circular dependency risks.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={fetchMatrix}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Matrix</span>
          </button>
        </div>

        {/* Filters Section */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search decisions by text..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-400 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                {STATUS_FILTERS.map((f) => (
                  <option
                    key={f.value}
                    value={f.value}
                    className="bg-slate-900 text-slate-200"
                  >
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">
              Generating decision dependency matrix...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-200 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-rose-300">
                Unable to load dependency matrix
              </h3>
              <p className="text-xs text-rose-400 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Decisions
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    {summary.totalDecisions || 0}
                  </span>
                  <span className="text-xs text-slate-400">nodes</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Dependencies Linked
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-indigo-400">
                    {summary.totalDependencies || 0}
                  </span>
                  <span className="text-xs text-slate-400">edges</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Matrix Density
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-cyan-400">
                    {summary.matrixDensityPercentage || 0}%
                  </span>
                  <span className="text-xs text-slate-400">connectivity</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Circular Dependency Cycles
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-extrabold ${
                      (summary.cyclesCount || 0) > 0
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {summary.cyclesCount || 0}
                  </span>
                  <span className="text-xs text-slate-400">detected</span>
                </div>
              </div>
            </div>

            {/* Cycle Warning Banner */}
            {cycles.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-semibold text-amber-300">
                    Circular Dependency Loops Detected
                  </h4>
                  {cycles.map((c, idx) => (
                    <p key={idx} className="text-amber-200/90 font-mono">
                      Cycle #{idx + 1}: {c.join(" ➔ ")}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Matrix 2D Table Grid */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl space-y-4 overflow-x-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">
                    2D Decision Cross-Tabular Matrix
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Rows = Source Decisions | Columns = Target Decisions
                </span>
              </div>

              {nodes.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm">
                  No decisions found matching your filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                        <th className="p-3 font-semibold min-w-[200px] sticky left-0 bg-slate-950 z-10">
                          Source Decision
                        </th>
                        {nodes.map((node, idx) => (
                          <th
                            key={node.id}
                            className="p-3 font-semibold text-center min-w-[120px] max-w-[150px] truncate"
                            title={node.label}
                          >
                            D{idx + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {nodes.map((rowNode, rIdx) => (
                        <tr
                          key={rowNode.id}
                          className="hover:bg-slate-850/50 transition-colors"
                        >
                          <td className="p-3 font-medium text-slate-200 sticky left-0 bg-slate-900/90 z-10 border-r border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                D{rIdx + 1}
                              </span>
                              <span
                                className="truncate max-w-[180px]"
                                title={rowNode.label}
                              >
                                {rowNode.label}
                              </span>
                            </div>
                          </td>
                          {nodes.map((colNode, cIdx) => {
                            const cell = grid[rIdx]?.[cIdx];
                            return (
                              <td
                                key={colNode.id}
                                onClick={() =>
                                  setSelectedCell({
                                    source: rowNode,
                                    target: colNode,
                                    cell,
                                  })
                                }
                                className="p-3 text-center cursor-pointer hover:bg-slate-800/60 transition-colors"
                              >
                                {getCellBadge(cell)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Cell Detail Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedCell(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Grid className="w-5 h-5 text-indigo-400" />
              <span>Dependency Detail</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">
                  Source Decision
                </span>
                <p className="text-slate-200 font-medium">
                  {selectedCell.source.label}
                </p>
                <span className="text-[10px] text-slate-500">
                  Owner: {selectedCell.source.owner} | Status:{" "}
                  {selectedCell.source.status}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">
                  Target Decision
                </span>
                <p className="text-slate-200 font-medium">
                  {selectedCell.target.label}
                </p>
                <span className="text-[10px] text-slate-500">
                  Owner: {selectedCell.target.owner} | Status:{" "}
                  {selectedCell.target.status}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 text-slate-300">
                <span className="text-slate-400 block font-semibold mb-1">
                  Relationship Type
                </span>
                <p className="font-mono text-indigo-400 uppercase">
                  {selectedCell.cell?.type || "none"}
                </p>
                {selectedCell.cell?.confidence && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Confidence: {selectedCell.cell.confidence}%
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedCell(null)}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionDependencyMatrix;
