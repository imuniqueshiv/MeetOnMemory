import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  Archive,
  Search,
  RotateCcw,
  Loader2,
  RefreshCw,
  FileText,
  Calendar,
  Tag,
  Clock,
  Filter,
  History,
  X,
  ShieldAlert,
} from "lucide-react";

const TYPE_OPTIONS = [
  { value: "all", label: "All Memory Types" },
  { value: "decision", label: "Decisions" },
  { value: "action-item", label: "Action Items" },
];

const KnowledgeArchive = () => {
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [archivedMemories, setArchivedMemories] = useState([]);

  // Server-side Pagination State (#835)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Restore Modal State
  const [restoreModal, setRestoreModal] = useState({
    isOpen: false,
    memory: null,
    reason: "",
  });

  // History Modal State
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    memory: null,
  });

  const loadArchivedMemories = useCallback(async () => {
    setLoading(true);
    try {
      let decisionList = [];
      let actionList = [];
      let totalDecisions = 0;
      let totalActions = 0;
      let dPages = 1;
      let aPages = 1;

      const queryOpts = {
        includeArchived: true,
        lifecycleState: "archived",
        page,
        limit,
        ...(searchQuery ? { search: searchQuery } : {}),
      };

      if (selectedType === "all" || selectedType === "decision") {
        const dRes = await knowledgeApi.getDecisions(
          "createdAt",
          null,
          queryOpts,
        );
        if (dRes.data?.success) {
          decisionList = (dRes.data.decisions || []).map((d) => ({
            ...d,
            type: "decision",
          }));
          totalDecisions = dRes.data.pagination?.total || decisionList.length;
          dPages = dRes.data.pagination?.totalPages || 1;
        }
      }

      if (selectedType === "all" || selectedType === "action-item") {
        const aRes = await knowledgeApi.getActionItems(
          "all",
          "createdAt",
          queryOpts,
        );
        if (aRes.data?.success) {
          actionList = (aRes.data.actionItems || []).map((a) => ({
            ...a,
            type: "action-item",
          }));
          totalActions = aRes.data.pagination?.total || actionList.length;
          aPages = aRes.data.pagination?.totalPages || 1;
        }
      }

      const combined = [...decisionList, ...actionList].sort(
        (a, b) =>
          new Date(b.archivedAt || b.updatedAt) -
          new Date(a.archivedAt || a.updatedAt),
      );

      setArchivedMemories(combined);

      const computedTotal =
        selectedType === "decision"
          ? totalDecisions
          : selectedType === "action-item"
            ? totalActions
            : totalDecisions + totalActions;
      setTotalCount(computedTotal);

      const maxPages = Math.max(dPages, aPages);
      setTotalPages(maxPages > 0 ? maxPages : 1);
    } catch (err) {
      console.error("Failed to load archived memories:", err);
      toast.error("Failed to fetch archived knowledge items.");
    } finally {
      setLoading(false);
    }
  }, [selectedType, searchQuery, page, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadArchivedMemories();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadArchivedMemories]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setRestoreModal((prev) => ({ ...prev, isOpen: false }));
        setHistoryModal((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const openRestoreModal = (memory) => {
    setRestoreModal({
      isOpen: true,
      memory,
      reason: "Restored from Knowledge Archive Browser",
    });
  };

  const confirmRestore = async () => {
    const { memory, reason } = restoreModal;
    if (!memory) return;

    setRestoringId(memory._id);
    setRestoreModal({ isOpen: false, memory: null, reason: "" });

    try {
      const res = await knowledgeApi.updateMemoryLifecycleState(
        memory.type,
        memory._id,
        "active",
        reason,
      );

      if (res.data?.success) {
        toast.success(`Memory successfully restored to Active Knowledge.`);
        await loadArchivedMemories();
      } else {
        toast.error(res.data?.message || "Failed to restore memory.");
      }
    } catch (err) {
      console.error("Restore error:", err);
      toast.error(err.response?.data?.message || "Failed to restore memory.");
    } finally {
      setRestoringId(null);
    }
  };

  // Derive unique tags / topics
  const allTags = Array.from(
    new Set(archivedMemories.flatMap((m) => m.aliases || []).filter(Boolean)),
  );

  const filteredMemories = archivedMemories.filter((mem) => {
    if (selectedTag !== "all") {
      return mem.aliases && mem.aliases.includes(selectedTag);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                <Archive className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Knowledge Archive Browser
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Search, review, and restore archived decisions and
                  organizational memory items.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadArchivedMemories}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Archive
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search archived decisions, action items, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Type Selector */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium cursor-pointer"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium cursor-pointer"
                >
                  <option value="all">All Topics / Tags</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div>
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-sm font-medium">
                Loading archived memories...
              </span>
            </div>
          )}

          {!loading && filteredMemories.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
              <Archive className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                No Archived Memories Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {searchQuery || selectedType !== "all" || selectedTag !== "all"
                  ? "No archived knowledge items match your current search or filter parameters."
                  : "There are currently no archived decisions or action items in your organization's knowledge base."}
              </p>
            </div>
          )}

          {!loading && filteredMemories.length > 0 && (
            <div className="space-y-4">
              {filteredMemories.map((mem) => (
                <div
                  key={mem._id}
                  className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <Archive className="w-3 h-3" /> Archived
                      </span>

                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {mem.type === "decision" ? "Decision" : "Action Item"}
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
                          <FileText className="w-3.5 h-3.5" />
                          Meeting: {mem.sourceMeetingId.title}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Created: {new Date(mem.createdAt).toLocaleDateString()}
                      </span>
                      {mem.archivedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          Archived:{" "}
                          {new Date(mem.archivedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => openRestoreModal(mem)}
                      disabled={restoringId === mem._id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
                    >
                      {restoringId === mem._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Restore Memory
                    </button>

                    <button
                      onClick={() =>
                        setHistoryModal({ isOpen: true, memory: mem })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" /> Audit History
                    </button>
                  </div>
                </div>
              ))}

              {/* Pagination Controls (#835) */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div className="text-slate-500 dark:text-slate-400 font-medium">
                  Showing page{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {page}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {totalPages}
                  </strong>{" "}
                  ({totalCount} total archived items)
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-400">
                      Per page:
                    </span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-medium cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      disabled={page <= 1 || loading}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={page >= totalPages || loading}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600" />
                Restore Archived Memory
              </h3>
              <button
                onClick={() =>
                  setRestoreModal({ isOpen: false, memory: null, reason: "" })
                }
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Restoring this memory will return it to{" "}
              <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Active State
              </strong>{" "}
              across your organization's Knowledge base.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 font-medium">
              "{restoreModal.memory?.text}"
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Restoring (optional)
              </label>
              <input
                type="text"
                value={restoreModal.reason}
                onChange={(e) =>
                  setRestoreModal((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() =>
                  setRestoreModal({ isOpen: false, memory: null, reason: "" })
                }
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                Confirm Restoration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Memory Audit Trail
              </h3>
              <button
                onClick={() => setHistoryModal({ isOpen: false, memory: null })}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                  No state transition records found.
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
                        {new Date(
                          h.timestamp || h.transitionedAt,
                        ).toLocaleString()}
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

export default KnowledgeArchive;
