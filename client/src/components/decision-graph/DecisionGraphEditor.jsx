import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  GitBranch,
  Archive,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";
import { toast } from "react-toastify";
import { useRBAC } from "../../hooks/useRBAC";
import { meetingApi } from "../../services/meetingApi";
import {
  createDecision,
  linkDecisions,
  supersedeDecision,
} from "../../services/decisionGraphApi";

const STATUSES = ["open", "in-progress", "resolved", "superseded"];

/**
 * Issue #2027 — create / link / supersede editor for the Decision Graph.
 * Gated by RBAC: only knowledge:create sees the create form and knowledge:edit
 * sees the relationship tools; everyone else stays view-only (the server also
 * enforces this).
 */
const DecisionGraphEditor = ({ nodes = [], onChanged }) => {
  const { hasPermission } = useRBAC();
  const canCreate = hasPermission("knowledge", "create");
  const canEdit = hasPermission("knowledge", "edit");

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meetings, setMeetings] = useState([]);

  // Create form
  const [text, setText] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("open");
  const [sourceMeetingId, setSourceMeetingId] = useState("");

  // Edge form
  const [edgeSource, setEdgeSource] = useState("");
  const [edgeTarget, setEdgeTarget] = useState("");
  const [confidence, setConfidence] = useState(100);

  useEffect(() => {
    if (!open || !canCreate) return;
    let active = true;
    meetingApi
      .getAllMeetings({ limit: 100 })
      .then((res) => {
        const list = res?.data?.meetings || res?.data?.data || res?.data || [];
        if (active && Array.isArray(list)) setMeetings(list);
      })
      .catch(() => {
        /* meeting list is a convenience; a manual id still works */
      });
    return () => {
      active = false;
    };
  }, [open, canCreate]);

  const nodeOptions = useMemo(
    () => nodes.map((n) => ({ id: n.id, label: n.label })),
    [nodes],
  );

  if (!canCreate && !canEdit) {
    return (
      <div className="mb-3 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
        <Lock size={12} /> View-only — you don’t have permission to edit the
        decision graph.
      </div>
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!text.trim()) return toast.error("Decision text is required.");
    if (!sourceMeetingId) return toast.error("Choose a source meeting.");
    try {
      setBusy(true);
      await createDecision({
        text: text.trim(),
        owner,
        status,
        sourceMeetingId,
      });
      toast.success("Decision created.");
      setText("");
      setOwner("");
      setStatus("open");
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create decision.");
    } finally {
      setBusy(false);
    }
  };

  const runEdge = async (kind) => {
    if (!edgeSource || !edgeTarget) return toast.error("Pick both decisions.");
    if (edgeSource === edgeTarget)
      return toast.error("A decision can’t link to itself.");
    try {
      setBusy(true);
      if (kind === "link") {
        await linkDecisions(edgeSource, {
          targetId: edgeTarget,
          confidence: Number(confidence),
        });
        toast.success("Decisions linked.");
      } else {
        await supersedeDecision(edgeSource, { targetId: edgeTarget });
        toast.success("Decision superseded.");
      }
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || `Failed to ${kind}.`);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800";

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-100"
      >
        <span className="flex items-center gap-2">
          <GitBranch size={16} /> Edit decision graph
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="grid gap-4 border-t border-gray-100 p-4 dark:border-gray-700 md:grid-cols-2">
          {canCreate && (
            <form onSubmit={handleCreate} className="space-y-2">
              <h3 className="flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Plus size={14} /> New decision
              </h3>
              <input
                className={`${inputCls} w-full`}
                placeholder="Decision text"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Owner (optional)"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
                <select
                  className={inputCls}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <select
                className={`${inputCls} w-full`}
                value={sourceMeetingId}
                onChange={(e) => setSourceMeetingId(e.target.value)}
              >
                <option value="">Source meeting…</option>
                {meetings.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title || m.name || m._id}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create decision"}
              </button>
            </form>
          )}

          {canEdit && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <GitBranch size={14} /> Link / supersede
              </h3>
              <select
                className={`${inputCls} w-full`}
                value={edgeSource}
                onChange={(e) => setEdgeSource(e.target.value)}
              >
                <option value="">From decision…</option>
                {nodeOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label?.slice(0, 60)}
                  </option>
                ))}
              </select>
              <select
                className={`${inputCls} w-full`}
                value={edgeTarget}
                onChange={(e) => setEdgeTarget(e.target.value)}
              >
                <option value="">To decision…</option>
                {nodeOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label?.slice(0, 60)}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Confidence
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`${inputCls} w-20`}
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => runEdge("link")}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <GitBranch size={14} /> Link (relatesTo)
                </button>
                <button
                  type="button"
                  onClick={() => runEdge("supersede")}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  <Archive size={14} /> Supersede
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DecisionGraphEditor;
