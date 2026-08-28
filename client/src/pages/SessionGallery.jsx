import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Presentation,
  Search,
  Plus,
  Tag,
  ExternalLink,
  CalendarPlus,
  Trash2,
  Copy,
  Check,
  Building2,
  Users,
  Calendar,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { sessionCardApi } from "../services";
import { toast } from "react-toastify";

const SessionGallery = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 24,
    totalPages: 1,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 24,
        search: debouncedSearch.trim() || undefined,
        tag: selectedTag || undefined,
        event: selectedEvent || undefined,
      };
      const response = await sessionCardApi.getSessionCards(params);
      if (response.data?.success) {
        const raw = response.data?.data || response.data;
        const list = Array.isArray(response.data?.sessions)
          ? response.data.sessions
          : Array.isArray(raw?.sessions)
            ? raw.sessions
            : [];
        setSessions(list);
        if (response.data?.pagination || raw?.pagination) {
          setPagination(response.data?.pagination || raw.pagination);
        }
      }
    } catch (error) {
      console.error("Error fetching session cards:", error);
      toast.error(
        error.response?.data?.message || "Failed to load session cards gallery",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedTag, selectedEvent]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (id, title) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${title || "this session card"}"?`,
      )
    ) {
      return;
    }

    try {
      const response = await sessionCardApi.deleteSessionCard(id);
      if (response.data?.success || response.status === 200) {
        toast.success("Session card deleted successfully");
        setSessions((prev) => prev.filter((s) => s._id !== id && s.id !== id));
      }
    } catch (error) {
      console.error("Error deleting session card:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete session card",
      );
    }
  };

  const handleCopy = (session, id) => {
    const textToCopy = `Session: ${session.sessionTitle}\nEvent: ${session.eventName || "N/A"}\nSpeaker: ${session.speaker || "N/A"}\n\nSummary:\n${session.summary || ""}\n\nKeywords: ${(session.keywords || []).join(", ")}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    toast.success("Session details copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReuse = (session) => {
    const cardId = session._id || session.id;
    if (cardId) {
      navigate(`/create-meeting?fromSessionCard=${cardId}`);
    } else {
      navigate("/create-meeting?tab=schedule");
    }
  };

  // Derive unique events and tags from current list for quick filters
  const allEvents = useMemo(() => {
    const set = new Set();
    sessions.forEach((s) => {
      if (s.eventName && s.eventName.trim()) set.add(s.eventName.trim());
    });
    return Array.from(set);
  }, [sessions]);

  const allTags = useMemo(() => {
    const set = new Set();
    sessions.forEach((s) => {
      (s.keywords || []).forEach((k) => k && set.add(k.trim()));
      (s.tags || []).forEach((t) => t && set.add(t.trim()));
    });
    return Array.from(set).slice(0, 15);
  }, [sessions]);

  const stats = useMemo(() => {
    const uniqueSpeakers = new Set();
    sessions.forEach((s) => {
      if (s.speaker && s.speaker.trim()) uniqueSpeakers.add(s.speaker.trim());
    });
    return {
      totalCards: pagination.total || sessions.length,
      speakers: uniqueSpeakers.size,
      events: allEvents.length,
    };
  }, [sessions, pagination.total, allEvents]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-slate-800 dark:text-slate-200">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 rounded-xl text-purple-600 dark:text-purple-400">
                <Presentation size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  Organization Session Cards
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Shared library of conference sessions, speaker profiles, and
                  AI-extracted summaries
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchSessions()}
              title="Refresh library"
              className="p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl transition cursor-pointer"
              aria-label="Refresh library"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <Link
              to="/create-meeting?tab=session"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              <Plus size={18} />
              <span>Generate Session Card</span>
            </Link>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <Sparkles size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Session Cards
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalCards}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Featured Speakers
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.speakers}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Conferences & Events
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.events}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 md:p-6 mb-8 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search session title, speaker, event, or keyword..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {allEvents.length > 0 && (
              <div className="w-full md:w-64">
                <select
                  value={selectedEvent}
                  onChange={(e) => {
                    setSelectedEvent(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Conferences & Events</option>
                  {allEvents.map((evt) => (
                    <option key={evt} value={evt}>
                      {evt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Tag Pills */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={12} /> Filter tags:
              </span>
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setSelectedTag("")}
                  className="px-2.5 py-1 bg-purple-600 text-white rounded-full text-xs font-medium flex items-center gap-1"
                >
                  <span>{selectedTag}</span>
                  <X size={12} />
                </button>
              )}
              {allTags.map((tag) => {
                if (tag === selectedTag) return null;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setSelectedTag(tag);
                      setPage(1);
                    }}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-purple-100 dark:bg-gray-800 dark:hover:bg-purple-950/60 text-gray-600 hover:text-purple-700 dark:text-gray-400 dark:hover:text-purple-300 rounded-full text-xs font-medium transition cursor-pointer"
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Gallery Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 animate-pulse space-y-4"
              >
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded-md w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md w-1/2" />
                <div className="h-20 bg-gray-100 dark:bg-gray-800/60 rounded-lg" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md w-full" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center shadow-xs">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Presentation size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No session cards found
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
              {searchQuery || selectedTag || selectedEvent
                ? "No session cards match your search criteria. Try clearing some filters."
                : "Your organization doesn't have any session cards yet. Generate your first card from presentation slides or videos!"}
            </p>
            {searchQuery || selectedTag || selectedEvent ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedTag("");
                  setSelectedEvent("");
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Clear all filters
              </button>
            ) : (
              <Link
                to="/create-meeting?tab=session"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
              >
                <Plus size={18} />
                <span>Generate New Session Card</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session, idx) => {
              const cardId = session._id || session.id || `card-${idx}`;
              return (
                <div
                  key={cardId}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800/80 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        {session.eventName && (
                          <span className="inline-block px-2.5 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 text-xs font-semibold rounded-full mb-1.5">
                            {session.eventName}
                          </span>
                        )}
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                          {session.sessionTitle}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(cardId, session.sessionTitle)
                        }
                        title="Delete session card"
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        aria-label="Delete session card"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Speaker info */}
                    {session.speaker && (
                      <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 rounded-xl">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Users
                            size={14}
                            className="text-purple-600 dark:text-purple-400"
                          />
                          <span>{session.speaker}</span>
                        </p>
                        {session.speakerTitle && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {session.speakerTitle}
                          </p>
                        )}
                        {session.speakerBio && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic line-clamp-2">
                            {session.speakerBio}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Summary */}
                    <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-4 mb-4 leading-relaxed">
                      {session.summary || "No summary provided."}
                    </p>

                    {/* Keywords */}
                    {session.keywords && session.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {session.keywords.slice(0, 5).map((keyword, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-medium rounded-md border border-purple-100 dark:border-purple-900/50 flex items-center gap-1"
                          >
                            <Tag size={10} /> {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 mt-2">
                    <div>
                      {session.videoUrl && (
                        <a
                          href={session.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          <ExternalLink size={13} />
                          <span>Video</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(session, cardId)}
                        title="Copy session details"
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition text-xs font-medium"
                      >
                        {copiedId === cardId ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReuse(session)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <CalendarPlus size={14} />
                        <span>Use in Draft</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 px-3">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionGallery;
