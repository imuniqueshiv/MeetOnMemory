import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  ShieldAlert,
  Loader2,
  ScanSearch,
  RefreshCw,
  CheckCircle2,
  XCircle,
  PenLine,
  Sparkles,
} from "lucide-react";

/**
 * ConflictResolution.jsx
 * Lets org admins/moderators scan for contradictory decisions/action
 * items, review the AI-generated explanation for each conflict, and
 * resolve it by keeping one member, entering a corrected value, or
 * dismissing the conflict as a false positive.
 */

const MODEL_OPTIONS = [
  { value: "decision", label: "Decisions" },
  { value: "actionItem", label: "Action Items" },
];

const ConflictResolution = () => {
  const [selectedModel, setSelectedModel] = useState("decision");
  const [scanning, setScanning] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [customValues, setCustomValues] = useState({});

  const loadConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await knowledgeApi.getConflicts({
        model: selectedModel,
        status: "open",
      });
      if (res.data?.success) {
        setConflicts(res.data.conflicts || []);
      }
    } catch (err) {
      console.error("Failed to load conflicts", err);
    } finally {
      setLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await knowledgeApi.scanForConflicts({
        dryRun: false,
        models: [selectedModel],
      });
      if (res.data?.success) {
        const found =
          res.data.report?.results?.[selectedModel]?.conflictsFound ?? 0;
        toast.success(
          found > 0
            ? `Scan complete — ${found} conflict${found === 1 ? "" : "s"} found.`
            : "Scan complete — no conflicts found.",
        );
        await loadConflicts();
      } else {
        toast.error(res.data?.message || "Scan failed.");
      }
    } catch (err) {
      console.error("Conflict scan error", err);
      toast.error(
        err.response?.data?.message || "Failed to run conflict scan.",
      );
    } finally {
      setScanning(false);
    }
  };

  const resolve = async (conflictId, resolutionType, extra = {}) => {
    setResolvingId(conflictId);
    try {
      const res = await knowledgeApi.resolveConflict(conflictId, {
        resolutionType,
        ...extra,
      });
      if (res.data?.success) {
        toast.success("Conflict resolved.");
        setConflicts((prev) => prev.filter((c) => c._id !== conflictId));
      } else {
        toast.error(res.data?.message || "Failed to resolve conflict.");
      }
    } catch (err) {
      console.error("Resolve conflict error", err);
      toast.error(err.response?.data?.message || "Failed to resolve conflict.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              Conflict Resolution
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Find memories that contradict each other and resolve them without
              losing either version.
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
            onClick={runScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ScanSearch className="w-4 h-4" />
            )}
            Scan for conflicts
          </button>
          <button
            onClick={loadConflicts}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div>
          {loading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading...
            </p>
          )}

          {!loading && conflicts.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No open conflicts — the knowledge graph is consistent. Try running
              a scan if new memories were just added.
            </p>
          )}

          <div className="space-y-4">
            {conflicts.map((conflict) => (
              <div
                key={conflict._id}
                className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                    <Sparkles className="w-4 h-4" />
                    Confidence: {conflict.confidence}%
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  {conflict.explanation}
                </p>

                <div className="grid gap-2 mt-3">
                  {(conflict.memberSnapshots || []).map((member) => (
                    <div
                      key={member.memoryId}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3"
                    >
                      <p className="text-sm text-slate-900 dark:text-white">
                        {member.text}
                      </p>
                      <button
                        onClick={() =>
                          resolve(conflict._id, "kept_member", {
                            keptMemoryId: member.memoryId,
                          })
                        }
                        disabled={resolvingId === conflict._id}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Keep this
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <input
                    type="text"
                    placeholder="Neither is right — enter the correct value..."
                    value={customValues[conflict._id] || ""}
                    onChange={(e) =>
                      setCustomValues((prev) => ({
                        ...prev,
                        [conflict._id]: e.target.value,
                      }))
                    }
                    className="flex-1 min-w-[220px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() =>
                      resolve(conflict._id, "custom_value", {
                        customValue: customValues[conflict._id] || "",
                      })
                    }
                    disabled={
                      resolvingId === conflict._id ||
                      !customValues[conflict._id]
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Save correction
                  </button>
                  <button
                    onClick={() => resolve(conflict._id, "dismissed")}
                    disabled={resolvingId === conflict._id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-500 dark:text-slate-400 text-xs font-medium hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Not a conflict
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolution;
