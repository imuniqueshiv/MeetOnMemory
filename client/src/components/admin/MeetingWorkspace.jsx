import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Search,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
  Lock,
  FileText,
  Database,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import { meetingApi } from "../../services";

const MeetingWorkspace = ({
  meetings = [],
  loading = false,
  onRefresh,
  onOpenEmbeddings,
  isAdmin = false,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [actionMeetingId, setActionMeetingId] = useState(null);

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const title = (m.title || "").toLowerCase();
      const status = (m.status || "recorded").toLowerCase();
      const matchesSearch = !search || title.includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter.toLowerCase() ||
        (statusFilter === "encrypted" &&
          (m.isTranscriptEncrypted || m.encryptedTranscript));
      return matchesSearch && matchesStatus;
    });
  }, [meetings, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMeetings.length / pageSize));
  const paginatedMeetings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMeetings.slice(start, start + pageSize);
  }, [filteredMeetings, currentPage, pageSize]);

  const handleDeleteMeeting = async (meetingId, title) => {
    if (!isAdmin) return;
    if (
      !window.confirm(
        `Are you sure you want to move "${title || "this meeting"}" to trash?`,
      )
    ) {
      return;
    }

    try {
      setActionMeetingId(meetingId);
      await meetingApi.deleteMeeting(meetingId, "Admin moderation action");
      toast.success("Meeting moved to trash");
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete meeting");
    } finally {
      setActionMeetingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            Meeting Records & Intelligence Workspace
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit organization meeting records, verify E2EE encryption status,
            and inspect AI embeddings.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenEmbeddings && (
            <button
              type="button"
              onClick={onOpenEmbeddings}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Embedding Index</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate("/meetings")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
          >
            <span>All Meetings View</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Controls Bar: Search & Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search meeting titles, dates, or keywords..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          />
        </div>

        <div className="relative">
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="recorded">Recorded</option>
            <option value="encrypted">E2EE Encrypted</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
          Loading meeting workspace...
        </div>
      ) : paginatedMeetings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="py-3 px-4">Meeting Title</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Security / AI Index</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedMeetings.map((m) => {
                const mid = m._id || m.id;
                const isEncrypted = Boolean(
                  m.isTranscriptEncrypted || m.encryptedTranscript,
                );

                return (
                  <tr
                    key={mid}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {m.title || "Untitled Meeting"}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>ID: {mid.slice(-6)}</span>
                        {m.participants?.length > 0 && (
                          <span>• {m.participants.length} attendees</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {m.date
                          ? new Date(m.date).toLocaleDateString()
                          : "No date"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isEncrypted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50">
                            <Lock className="w-3 h-3" /> E2EE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
                            Standard
                          </span>
                        )}

                        {m.embeddingIndex?.status === "indexed" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400">
                            <Sparkles className="w-3 h-3" /> Indexed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                        {m.status || "Recorded"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/meeting/${mid}`)}
                          title="Open Meeting Details"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMeeting(mid, m.title)}
                            disabled={actionMeetingId === mid}
                            title="Move to Trash"
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          No meeting records matched your search criteria.
        </div>
      )}

      {/* Pagination Footer */}
      {filteredMeetings.length > pageSize && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, filteredMeetings.length)} of{" "}
            {filteredMeetings.length} meetings
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingWorkspace;
