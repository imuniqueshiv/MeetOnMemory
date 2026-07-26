import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  Camera,
  GitCompare,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Plus,
  Minus,
  Pencil,
  Users,
  CheckSquare,
  Square,
} from "lucide-react";

/**
 * GraphSnapshots.jsx
 *
 * Memory Graph Snapshot & Time-Travel view (issue #374).
 * Lets users browse historical captures of the knowledge graph, pick any
 * two to compare, and see exactly what nodes/edges were added, removed,
 * or modified between them.
 */

const TRIGGER_LABELS = {
  meeting_processed: "Meeting processed",
  consolidation: "Consolidation",
  manual: "Manual",
  scheduled: "Scheduled",
};

const TYPE_LABELS = {
  decision: "Decision",
  actionItem: "Action Item",
  meeting: "Meeting",
};

function SnapshotRow({ snapshot, selected, onToggle }) {
  return (
    <button
      onClick={() => onToggle(snapshot._id)}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
          : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {new Date(snapshot.createdAt).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {TRIGGER_LABELS[snapshot.trigger] || snapshot.trigger}
            {snapshot.sourceMeetingId?.title
              ? ` • ${snapshot.sourceMeetingId.title}`
              : ""}
          </p>
        </div>
        {selected ? (
          <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        ) : (
          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{snapshot.metadata?.nodeCount ?? 0} nodes</span>
        <span>{snapshot.metadata?.edgeCount ?? 0} edges</span>
        <span>{snapshot.metadata?.decisionCount ?? 0} decisions</span>
        <span>{snapshot.metadata?.actionItemCount ?? 0} action items</span>
      </div>
    </button>
  );
}

function DiffNodeCard({ node, tone }) {
  const toneStyles = {
    added:
      "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30",
    removed: "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30",
    modified:
      "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30",
  };
  const Icon = tone === "added" ? Plus : tone === "removed" ? Minus : Pencil;
  const iconColor =
    tone === "added"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "removed"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className={`rounded-lg border p-3 ${toneStyles[tone]}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {TYPE_LABELS[node.type] || node.type}
          </p>
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {node.text || node.after?.text || "(untitled)"}
          </p>
          {tone === "modified" && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Changed: {node.changedFields.join(", ")}
              {node.changedFields.includes("status") && (
                <span className="ml-1">
                  ({node.before.status || "—"} → {node.after.status || "—"})
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const GraphSnapshots = () => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [selected, setSelected] = useState([]); // up to 2 snapshot ids, oldest first
  const [diff, setDiff] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await knowledgeApi.getGraphSnapshots({ limit: 50 });
      if (res.data?.success) {
        setSnapshots(res.data.snapshots || []);
      }
    } catch (err) {
      console.error("Failed to load graph snapshots", err);
      toast.error("Failed to load graph snapshots.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const toggleSelect = (id) => {
    setDiff(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length < 2) return [...prev, id];
      // Replace the oldest selection so the picker always keeps the two
      // most-recently-clicked snapshots.
      return [prev[1], id];
    });
  };

  const runDiff = async () => {
    if (selected.length !== 2) return;

    // Compare chronologically: figure out which of the two is older by
    // looking the snapshots up in the already-loaded (newest-first) list.
    const indexOf = (id) => snapshots.findIndex((s) => s._id === id);
    const [a, b] = selected;
    const [fromId, toId] = indexOf(a) > indexOf(b) ? [a, b] : [b, a]; // higher index = older (list is newest-first)

    setDiffLoading(true);
    setDiff(null);
    try {
      const res = await knowledgeApi.diffGraphSnapshots(fromId, toId);
      if (res.data?.success) {
        setDiff(res.data.diff);
      } else {
        toast.error(res.data?.message || "Failed to compute diff.");
      }
    } catch (err) {
      console.error("Failed to diff graph snapshots", err);
      toast.error(
        err.response?.data?.message || "Failed to compute graph diff.",
      );
    } finally {
      setDiffLoading(false);
    }
  };

  const captureNow = async () => {
    setCapturing(true);
    try {
      const res = await knowledgeApi.createGraphSnapshot(false);
      if (res.data?.success) {
        if (res.data.skipped) {
          toast.info("No graph changes since the last snapshot.");
        } else {
          toast.success("Snapshot captured.");
          await loadSnapshots();
        }
      } else {
        toast.error(res.data?.message || "Failed to capture snapshot.");
      }
    } catch (err) {
      console.error("Failed to capture graph snapshot", err);
      toast.error(
        err.response?.data?.message || "Failed to capture graph snapshot.",
      );
    } finally {
      setCapturing(false);
    }
  };

  const downloadSnapshot = async (id) => {
    try {
      const res = await knowledgeApi.exportGraphSnapshot(id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `graph-snapshot-${id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export snapshot", err);
      toast.error("Failed to export snapshot.");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Memory Graph History
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Browse past states of the knowledge graph and compare any two
              snapshots to see what changed.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadSnapshots}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={captureNow}
              disabled={capturing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {capturing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              Capture snapshot
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Timeline */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Timeline{" "}
                <span className="text-slate-400 font-normal">
                  (select up to 2)
                </span>
              </h2>
              <button
                onClick={runDiff}
                disabled={selected.length !== 2 || diffLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium hover:opacity-90 disabled:opacity-40"
              >
                {diffLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <GitCompare className="w-3.5 h-3.5" />
                )}
                Compare
              </button>
            </div>

            {loading && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading...
              </p>
            )}
            {!loading && snapshots.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No snapshots yet. Process a meeting or capture one manually to
                get started.
              </p>
            )}

            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {snapshots.map((s) => (
                <div key={s._id} className="relative group">
                  <SnapshotRow
                    snapshot={s}
                    selected={selected.includes(s._id)}
                    onToggle={toggleSelect}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSnapshot(s._id);
                    }}
                    title="Export snapshot"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Diff view */}
          <div className="lg:col-span-3">
            {!diff && !diffLoading && (
              <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Select two snapshots from the timeline and click{" "}
                  <strong>Compare</strong> to see how the graph evolved between
                  them.
                </p>
              </div>
            )}

            {diffLoading && (
              <div className="h-full flex items-center justify-center p-10">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            )}

            {diff && !diffLoading && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Users className="w-4 h-4" />
                    {new Date(diff.from.createdAt).toLocaleString()} →{" "}
                    {new Date(diff.to.createdAt).toLocaleString()}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{diff.summary.nodesAdded} nodes
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      -{diff.summary.nodesRemoved} nodes
                    </span>
                    <span className="text-amber-600 dark:text-amber-400">
                      ~{diff.summary.nodesModified} modified
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{diff.summary.edgesAdded} edges
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      -{diff.summary.edgesRemoved} edges
                    </span>
                  </div>
                </div>

                {diff.summary.nodesAdded +
                  diff.summary.nodesRemoved +
                  diff.summary.nodesModified ===
                  0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No node-level changes between these two snapshots.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {diff.nodes.added.map((n) => (
                    <DiffNodeCard key={`add-${n.key}`} node={n} tone="added" />
                  ))}
                  {diff.nodes.removed.map((n) => (
                    <DiffNodeCard
                      key={`rem-${n.key}`}
                      node={n}
                      tone="removed"
                    />
                  ))}
                  {diff.nodes.modified.map((n) => (
                    <DiffNodeCard
                      key={`mod-${n.key}`}
                      node={n}
                      tone="modified"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphSnapshots;
