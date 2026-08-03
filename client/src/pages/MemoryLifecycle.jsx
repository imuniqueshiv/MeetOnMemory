// client/src/pages/MemoryLifecycle.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  History,
  Loader2,
  RefreshCw,
  Search,
  Archive,
  RotateCcw,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Calendar,
  X,
  ChevronDown,
} from "lucide-react";

const LIFECYCLE_STATES = [
  { value: "all", label: "All Memories" },
  { value: "active", label: "Active" },
  { value: "dormant", label: "Dormant" },
  { value: "archived", label: "Archived" },
  { value: "expired", label: "Expired" },
];

const MEMORY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "decision", label: "Decisions" },
  { value: "action-item", label: "Action Items" },
];

const ITEMS_PER_PAGE = 20; // Server-side pagination limit

const MemoryLifecycle = () => {
  const navigate = useNavigate();
  const [selectedState, setSelectedState] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [memories, setMemories] = useState([]);

  // Transition Modal State
  const [transitionModal, setTransitionModal] = useState({
    isOpen: false,
    memory: null,
    targetState: "",
    reason: "",
  });

  // History Modal State
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    memory: null,
  });

  const loadMemories = useCallback(
    async (reset = false) => {
      const currentPage = reset ? 1 : page;

      if (reset) {
        setLoading(true);
        setMemories([]);
        setPage(1);
      } else {
        setLoading(false); // Keep existing data visible while fetching more
      }

      try {
        let decisionList = [];
        let actionList = [];

        const opts = {
          includeArchived: true,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          ...(selectedState !== "all" ? { lifecycleState: selectedState } : {}),
          ...(searchQuery ? { search: searchQuery } : {}),
        };

        if (selectedType === "all" || selectedType === "decision") {
          const dRes = await knowledgeApi.getDecisions("createdAt", null, opts);
          if (dRes.data?.success) {
            decisionList = (dRes.data.decisions || []).map((d) => ({
              ...d,
              type: "decision",
            }));
          }
        }

        if (selectedType === "all" || selectedType === "action-item") {
          const aRes = await knowledgeApi.getActionItems(
            "all",
            "createdAt",
            opts,
          );
          if (aRes.data?.success) {
            actionList = (aRes.data.actionItems || []).map((a) => ({
              ...a,
              type: "action-item",
            }));
          }
        }

        const combined = [...decisionList, ...actionList].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );

        // Check if we received fewer items than the limit, indicating no more pages
        if (combined.length < ITEMS_PER_PAGE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        setMemories((prev) => (reset ? combined : [...prev, ...combined]));
      } catch (err) {
        console.error("Failed to load memories:", err);
        toast.error("Failed to load knowledge lifecycle items.");
      } finally {
        setLoading(false);
      }
    },
    [selectedState, selectedType, searchQuery, page],
  );

  // Debounced effect for filter changes (resets pagination)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadMemories(true);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, selectedType, searchQuery]);

  // Keyboard accessibility for modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setTransitionModal((prev) => ({ ...prev, isOpen: false }));
        setHistoryModal((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  // Fetch next page when `page` state increments
  useEffect(() => {
    if (page > 1) {
      loadMemories(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleRunSweep = async () => {
    setSweeping(true);
    try {
      const res = await knowledgeApi.runLifecycleSweep();
      if (res.data?.success) {
        toast.success(
          res.data.message || "Lifecycle sweep completed successfully.",
        );
        await loadMemories(true);
      } else {
        toast.error(res.data?.message || "Failed to run lifecycle sweep.");
      }
    } catch (err) {
      console.error("Sweep error:", err);
      toast.error(
        err.response?.data?.message || "Failed to trigger lifecycle sweep.",
      );
    } finally {
      setSweeping(false);
    }
  };

  const openTransitionModal = (memory, targetState) => {
    setTransitionModal({
      isOpen: true,
      memory,
      targetState,
      reason: `Transitioning to ${targetState}`,
    });
  };

  const confirmTransition = async () => {
    const { memory, targetState, reason } = transitionModal;
    if (!memory || !targetState) return;

    setUpdatingId(memory._id);
    setTransitionModal({
      isOpen: false,
      memory: null,
      targetState: "",
      reason: "",
    });

    try {
      const res = await knowledgeApi.updateMemoryLifecycleState(
        memory.type,
        memory._id,
        targetState,
        reason,
      );

      if (res.data?.success) {
        toast.success(`Memory transitioned to ${targetState}.`);
        await loadMemories(true); // Reset pagination on state change
      } else {
        toast.error(res.data?.message || "Failed to update lifecycle state.");
      }
    } catch (err) {
      console.error("Update state error:", err);
      toast.error(
        err.response?.data?.message || "Failed to update memory state.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const getStateBadge = (state) => {
    switch (state) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3 h-3" /> Active
          </span>
        );
      case "dormant":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Dormant
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Archive className="w-3 h-3" /> Archived
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-3 h-3" /> Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {state || "active"}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Memory Lifecycle Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Monitor, archive, restore, and manage organizational knowledge
              retention states.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/knowledge/archive")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-xs cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              Archive Browser
            </button>
            <button
              onClick={handleRunSweep}
              disabled={sweeping}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {sweeping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Run Lifecycle Sweep
            </button>
            <button
              onClick={() => loadMemories(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Lifecycle State Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl overflow-x-auto">
              {LIFECYCLE_STATES.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedState(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedState === tab.value
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Type selector & Search input */}
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium cursor-pointer"
              >
                {MEMORY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search memory text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content List */}
        <div>
          {loading && page === 1 && (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span className="text-sm font-medium">Loading memories...</span>
            </div>
          )}

          {!loading && memories.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                No memories found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                No knowledge records match the selected state or filter
                criteria. Try selecting another state tab or adjusting your
                search.
              </p>
            </div>
          )}

          {!loading && memories.length > 0 && (
            <>
              <div className="space-y-3">
                {memories.map((mem) => {
                  const currentState = mem.lifecycleState || "active";
                  return (
                    <div
                      key={mem._id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {getStateBadge(currentState)}
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {mem.type === "decision"
                              ? "Decision"
                              : "Action Item"}
                          </span>
                          {mem.importanceScore !== undefined && (
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Score:{" "}
                              <strong className="text-slate-800 dark:text-slate-200">
                                {mem.importanceScore}
                              </strong>
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                          {mem.text}
                        </p>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                          {mem.sourceMeetingId?.title && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Meeting: {mem.sourceMeetingId.title}
                            </span>
                          )}
                          <span>
                            Created:{" "}
                            {new Date(mem.createdAt).toLocaleDateString()}
                          </span>
                          {mem.lastAccessedAt && (
                            <span>
                              Last accessed:{" "}
                              {new Date(
                                mem.lastAccessedAt,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                        {currentState !== "active" && (
                          <button
                            onClick={() => openTransitionModal(mem, "active")}
                            disabled={updatingId === mem._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                        )}
                        {currentState === "active" && (
                          <button
                            onClick={() => openTransitionModal(mem, "archived")}
                            disabled={updatingId === mem._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-xs"
                          >
                            <Archive className="w-3.5 h-3.5" /> Archive
                          </button>
                        )}
                        {currentState === "active" && (
                          <button
                            onClick={() => openTransitionModal(mem, "dormant")}
                            disabled={updatingId === mem._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" /> Dormant
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setHistoryModal({ isOpen: true, memory: mem })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          History
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button for Pagination */}
              {!loading && hasMore && (
                <div className="flex justify-center pt-6">
                  <button
                    onClick={handleLoadMore}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-sm"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Load More Memories
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transition Confirmation Modal */}
      {transitionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                {transitionModal.targetState === "active"
                  ? "Restore Memory"
                  : `Change State to ${transitionModal.targetState}`}
              </h3>
              <button
                onClick={() =>
                  setTransitionModal({
                    isOpen: false,
                    memory: null,
                    targetState: "",
                    reason: "",
                  })
                }
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to transition this memory to{" "}
              <strong className="text-indigo-600 dark:text-indigo-400 uppercase">
                {transitionModal.targetState}
              </strong>
              ?
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 font-medium">
              "{transitionModal.memory?.text}"
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason / Note (optional)
              </label>
              <input
                type="text"
                value={transitionModal.reason}
                onChange={(e) =>
                  setTransitionModal((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() =>
                  setTransitionModal({
                    isOpen: false,
                    memory: null,
                    targetState: "",
                    reason: "",
                  })
                }
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmTransition}
                disabled={updatingId === transitionModal.memory?._id}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Confirm State Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Timeline Modal */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Lifecycle Audit History
              </h3>
              <button
                onClick={() => setHistoryModal({ isOpen: false, memory: null })}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
              Memory: "{historyModal.memory?.text}"
            </p>
            <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
              {(historyModal.memory?.lifecycleHistory || []).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No previous transition records for this memory.
                </p>
              ) : (
                historyModal.memory.lifecycleHistory.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold">
                      <span>
                        {h.fromState || "active"} →{" "}
                        <strong className="text-indigo-600 dark:text-indigo-400 uppercase">
                          {h.toState}
                        </strong>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {h.reason && (
                      <p className="text-slate-500 dark:text-slate-400 italic">
                        Reason: {h.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setHistoryModal({ isOpen: false, memory: null })}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryLifecycle;
