import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  GitMerge,
  Loader2,
  Sparkles,
  Tags,
  History,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

/**
 * MemoryConsolidation.jsx
 * Lets org admins/moderators preview and run the AI-Powered Memory
 * Consolidation Engine, which detects duplicate/paraphrased decisions and
 * action items and merges them into a single canonical memory.
 */

const MODEL_OPTIONS = [
  { value: "decision", label: "Decisions" },
  { value: "actionItem", label: "Action Items" },
];

const MemoryConsolidation = () => {
  const [selectedModel, setSelectedModel] = useState("decision");
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await knowledgeApi.getConsolidationHistory(selectedModel);
      if (res.data?.success) {
        setHistory(res.data.memories || []);
      }
    } catch (err) {
      console.error("Failed to load consolidation history", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runEngine = async (dryRun) => {
    setRunning(true);
    setReport(null);
    try {
      const res = await knowledgeApi.runConsolidation({
        dryRun,
        models: [selectedModel],
      });
      if (res.data?.success) {
        setReport(res.data.report);
        toast.success(
          dryRun
            ? "Preview generated — nothing was merged yet."
            : "Memories consolidated successfully.",
        );
        if (!dryRun) await loadHistory();
      } else {
        toast.error(res.data?.message || "Consolidation failed.");
      }
    } catch (err) {
      console.error("Consolidation error", err);
      toast.error(
        err.response?.data?.message || "Failed to run memory consolidation.",
      );
    } finally {
      setRunning(false);
    }
  };

  const modelReport = report?.results?.[selectedModel];

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GitMerge className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Memory Consolidation
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Find duplicate or paraphrased memories and merge them into one
              canonical record without losing history.
            </p>
          </div>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runEngine(true)}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Preview merges
          </button>
          <button
            onClick={() => runEngine(false)}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GitMerge className="w-4 h-4" />
            )}
            Consolidate now
          </button>
        </div>

        {modelReport && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {report.dryRun ? "Preview" : "Consolidation"} results
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Scanned {modelReport.recordsScanned} memories, found{" "}
              {modelReport.clustersFound} duplicate cluster
              {modelReport.clustersFound === 1 ? "" : "s"}.
            </p>

            {modelReport.merges.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                No duplicates found — the graph is already clean.
              </p>
            )}

            <div className="space-y-4 mt-4">
              {modelReport.merges.map((merge) => (
                <div
                  key={merge.canonicalId}
                  className="rounded-lg border border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40"
                >
                  <p className="font-medium text-slate-900 dark:text-white">
                    {merge.canonicalText}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Absorbed {merge.mergedIds.length} duplicate
                    {merge.mergedIds.length === 1 ? "" : "s"}
                  </p>

                  {merge.aliasesAdded.length > 0 && (
                    <div className="flex items-start gap-2 mt-3 text-xs text-slate-600 dark:text-slate-300">
                      <Tags className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{merge.aliasesAdded.join(" • ")}</span>
                    </div>
                  )}

                  {merge.conflicts.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {merge.conflicts.map((conflict) => (
                        <div
                          key={conflict.field}
                          className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"
                        >
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>
                            <strong>{conflict.field}</strong> conflicted (
                            {conflict.values.join(" vs ")}) —{" "}
                            {conflict.resolution}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              Previously consolidated memories
            </h2>
            <button
              onClick={loadHistory}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {historyLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading...
            </p>
          )}

          {!historyLoading && history.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No memories have been consolidated yet.
            </p>
          )}

          <div className="space-y-3">
            {history.map((memory) => (
              <div
                key={memory._id}
                className="rounded-lg border border-slate-100 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50"
              >
                <p className="font-medium text-slate-900 dark:text-white">
                  {memory.text}
                </p>
                {memory.aliases?.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Aliases: {memory.aliases.join(", ")}
                  </p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {memory.mergedFrom?.length || 0} memories merged • last
                  consolidated{" "}
                  {memory.lastConsolidatedAt
                    ? new Date(memory.lastConsolidatedAt).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryConsolidation;
