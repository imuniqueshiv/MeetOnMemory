import React, { useCallback, useEffect, useRef, useState, useId } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/meetings/Pagination.jsx";
import { meetingApi } from "../services";
import useExport from "../hooks/useExport.js";
import { toast } from "react-toastify";
import {
  FileText,
  Loader2,
  Search,
  MoreVertical,
  X,
  Copy,
  Trash2,
  Star,
  Pin,
  Mic,
  MicOff,
  Download,
  AlertCircle,
  RefreshCw,
  Printer,
} from "lucide-react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SummaryViewModal = ({ summary, onClose }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!summary) return;

    previouslyFocusedRef.current = document.activeElement;
    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusables = [
        ...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ];
      if (!focusables.length) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [summary, onClose]);

  if (!summary) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2
            id={titleId}
            className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3"
          >
            <FileText className="w-6 h-6 text-indigo-600" />
            {summary.title || t("aiSearch.untitledMeeting")}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          >
            <X size={24} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-grow">
          <p className="text-sm text-gray-500 mb-4">
            <strong>{t("aiSearch.date")}:</strong>{" "}
            {summary.createdAt
              ? new Date(summary.createdAt).toLocaleString()
              : t("aiSearch.unknown")}
          </p>
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {t("aiSearch.summary")}:
            </h3>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {summary.summary || summary.transcript || t("aiSearch.noSummary")}
            </p>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(
                summary.summary || summary.transcript || "",
              );
              toast.success(t("aiSearch.copiedToClipboard"));
            }}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Copy size={16} /> {t("summaries.copy")}
          </button>
          <button
            type="button"
            onClick={() => {
              window.print();
            }}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Printer size={16} /> {t("summaries.print", "Print MoM")}
          </button>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob(
                [summary.summary || summary.transcript || ""],
                { type: "text/plain;charset=utf-8" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${summary.title || "meeting"}_summary.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 ml-auto"
          >
            {t("summaries.download", "Download")}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Summaries.jsx
 * Displays meeting summaries with server-side pagination, search, and sorting.
 * Supports text and voice search; pin/star remain local page preferences.
 */

const PAGE_SIZE = 9;
const SEARCH_DEBOUNCE_MS = 300;

const Summaries = () => {
  const { t } = useTranslation();
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 0,
  });
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const pageCacheRef = useRef(new Map());
  const requestIdRef = useRef(0);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [starredIds, setStarredIds] = useState([]);
  const [openExportMenuId, setOpenExportMenuId] = useState(null);
  const { exportMeeting, isExporting } = useExport();

  const getCacheKey = useCallback(
    (page, searchTerm) =>
      `${page}|${PAGE_SIZE}|createdAt|desc|${searchTerm.trim().toLowerCase()}`,
    [],
  );

  const invalidatePageCache = useCallback(() => {
    pageCacheRef.current.clear();
  }, []);

  // Debounce search input → server query (reset page only when term changes)
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch((prev) => {
        if (prev === next) return prev;
        setCurrentPage(1);
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Setup browser-based voice recognition
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSearch((prev) => (prev ? `${prev} ${transcript}` : transcript));
        toast.success(`🎤 Recognized: "${transcript}"`);
      };

      recognition.onerror = () => {
        toast.error("Voice input not recognized. Please try again.");
        setListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Voice recognition not supported in this browser.");
    }
  }, []);

  const handleVoiceSearch = () => {
    if (!recognitionRef.current) {
      toast.error("Voice search not supported in this browser.");
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      toast.info("🎙️ Voice recognition stopped.");
    } else {
      recognitionRef.current.start();
      toast.info("🎤 Listening... Speak now!");
    }
  };

  const fetchSummaries = useCallback(
    async (page, searchTerm, { force = false } = {}) => {
      const cacheKey = getCacheKey(page, searchTerm);
      if (!force && pageCacheRef.current.has(cacheKey)) {
        const cached = pageCacheRef.current.get(cacheKey);
        setSummaries(cached.meetings);
        setPagination(cached.pagination);
        setError(null);
        setLoading(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      setLoading(true);

      try {
        const res = await meetingApi.getAllMeetings({
          page,
          limit: PAGE_SIZE,
          search: searchTerm || undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        if (requestId !== requestIdRef.current) return;

        if (res.data?.success) {
          setError(null);
          const meetings = res.data.meetings || [];
          const nextPagination = res.data.pagination || {
            total: meetings.length,
            page,
            limit: PAGE_SIZE,
            totalPages: 1,
          };
          pageCacheRef.current.set(cacheKey, {
            meetings,
            pagination: nextPagination,
          });
          setSummaries(meetings);
          setPagination(nextPagination);
        } else {
          setError(
            res.data?.message ||
              t("summaries.loadFailed") ||
              "Failed to load summaries",
          );
          toast.error(res.data?.message || t("summaries.loadFailed"));
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Error fetching summaries:", error);
        setError(
          t("summaries.loadFailed") ||
            "Failed to load summaries. Please check your connection and try again.",
        );
        toast.error(t("summaries.loadFailed"));
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [getCacheKey, t],
  );

  useEffect(() => {
    fetchSummaries(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch, fetchSummaries]);

  const handleSearchSubmit = () => {
    const nextSearch = search.trim();
    setDebouncedSearch(nextSearch);
    setCurrentPage(1);
    fetchSummaries(1, nextSearch, { force: true });
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Pin/star reorder only within the current page (local preference)
  const sortedSummaries = [...summaries].sort((a, b) => {
    const aPinned = pinnedIds.includes(a._id);
    const bPinned = pinnedIds.includes(b._id);
    const aStarred = starredIds.includes(a._id);
    const bStarred = starredIds.includes(b._id);

    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    return 0;
  });

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this meeting?"))
      return;

    try {
      const res = await meetingApi.deleteMeeting(id);

      if (res.data?.success) {
        invalidatePageCache();
        setPinnedIds((prev) => prev.filter((pid) => pid !== id));
        setStarredIds((prev) => prev.filter((sid) => sid !== id));
        toast.success("Meeting deleted successfully");

        const remainingOnPage = summaries.filter((s) => s._id !== id).length;
        const nextPage =
          remainingOnPage === 0 && currentPage > 1
            ? currentPage - 1
            : currentPage;

        if (nextPage !== currentPage) {
          setCurrentPage(nextPage);
        } else {
          await fetchSummaries(nextPage, debouncedSearch, { force: true });
        }
      } else {
        toast.error(res.data?.message || "Failed to delete meeting");
      }
    } catch (err) {
      console.error("Delete Error:", err);
      toast.error("Server error while deleting meeting");
    } finally {
      setOpenMenuId(null);
    }
  };

  const togglePin = (id) => {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  };

  const toggleStar = (id) => {
    setStarredIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const handleCopy = (summary) => {
    navigator.clipboard.writeText(summary.summary || summary.transcript || "");
    toast.success(t("aiSearch.copiedToClipboard"));
  };

  const handleExport = (meeting, format) => {
    exportMeeting(meeting, format);
  };

  const emptyMessage = t("summaries.noSummaries");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      {/* Centered Container */}
      <div className="flex flex-col items-center justify-center flex-grow px-6 py-20 md:py-28">
        <div className="w-full max-w-5xl text-center">
          {/* Header */}
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center justify-center gap-2">
            🧠{" "}
            <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
              {t("dashboard.aiSummarization")}
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {t("dashboard.aiSummarizationDesc")}
          </p>

          {/* Search Bar with Voice + Text */}
          <div className="flex items-center justify-center mb-10">
            <div className="flex items-center w-full sm:w-[30rem] bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-full overflow-hidden hover:ring-2 hover:ring-blue-300 transition">
              <input
                type="text"
                placeholder={t("summaries.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit();
                }}
                className="flex-grow px-4 py-2 text-sm text-gray-700 focus:outline-none bg-transparent dark:text-gray-200"
              />
              <button
                onClick={handleVoiceSearch}
                className={`px-3 py-2 border-l border-gray-200 transition flex items-center justify-center ${
                  listening
                    ? "text-red-500 animate-pulse"
                    : "text-gray-600 hover:text-blue-600"
                }`}
                title={listening ? "Stop Listening" : "Start Voice Search"}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-r-full hover:bg-blue-700 transition flex items-center gap-2"
                onClick={handleSearchSubmit}
              >
                <Search size={16} /> {t("common.search")}
              </button>
            </div>
          </div>

          {/* Main Section */}
          {loading ? (
            <div className="flex justify-center items-center py-10 text-gray-500">
              <Loader2 className="animate-spin w-6 h-6 mr-2" />{" "}
              {t("summaries.loading")}
            </div>
          ) : error ? (
            <div
              data-testid="summaries-error-state"
              className="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-md border border-red-200 dark:border-red-800 max-w-md mx-auto text-center"
            >
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                Failed to Load Summaries
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                {error}
              </p>
              <button
                data-testid="retry-button"
                onClick={() =>
                  fetchSummaries(currentPage, debouncedSearch, { force: true })
                }
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          ) : sortedSummaries.length > 0 ? (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
                {sortedSummaries.map((summary) => (
                  <div
                    key={summary._id}
                    data-testid="summary-card"
                    className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-md hover:shadow-lg border border-gray-100 dark:border-gray-700 transition-all duration-300 p-6 text-left hover:-translate-y-1 relative"
                  >
                    {/* Top indicators */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      {pinnedIds.includes(summary._id) && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <Pin size={12} /> {t("summaries.pin")}
                        </span>
                      )}
                      {starredIds.includes(summary._id) && (
                        <span className="text-yellow-500">
                          <Star size={16} fill="currentColor" />
                        </span>
                      )}
                    </div>

                    {/* Three Dots Menu */}
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === summary._id ? null : summary._id,
                          )
                        }
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
                      >
                        <MoreVertical
                          size={20}
                          className="text-gray-600 dark:text-gray-400"
                        />
                      </button>

                      {openMenuId === summary._id && (
                        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-10">
                          <button
                            onClick={() => setViewModal(summary)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                          >
                            <FileText size={16} /> {t("summaries.view")}
                          </button>
                          <button
                            onClick={() => handleCopy(summary)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                          >
                            <Copy size={16} /> {t("summaries.copy")}
                          </button>
                          <button
                            onClick={() => toggleStar(summary._id)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                          >
                            <Star size={16} />{" "}
                            {starredIds.includes(summary._id)
                              ? t("summaries.unstar")
                              : t("summaries.star")}
                          </button>
                          <button
                            onClick={() => togglePin(summary._id)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                          >
                            <Pin size={16} />{" "}
                            {pinnedIds.includes(summary._id)
                              ? t("summaries.unpin")
                              : t("summaries.pin")}
                          </button>
                          <button
                            onClick={() => handleDelete(summary._id)}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 rounded-b-lg"
                          >
                            <Trash2 size={16} /> {t("summaries.delete")}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-3 mt-8">
                      <FileText className="w-6 h-6 text-indigo-600" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {summary.title || t("aiSearch.untitledMeeting")}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      {summary.createdAt
                        ? new Date(summary.createdAt).toLocaleString()
                        : t("aiSearch.unknown")}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-5 whitespace-pre-wrap">
                      {summary.summary ||
                        (summary.transcript
                          ? `${summary.transcript.slice(0, 200)}...`
                          : t("aiSearch.noSummary"))}
                    </p>

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setViewModal(summary)}
                        className="text-sm px-4 py-1.5 rounded-md border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {t("summaries.view")}
                      </button>

                      <div
                        className="relative ml-auto"
                        onMouseEnter={() => setOpenExportMenuId(summary._id)}
                        onMouseLeave={() => setOpenExportMenuId(null)}
                      >
                        <button
                          onClick={() =>
                            setOpenExportMenuId(
                              openExportMenuId === summary._id
                                ? null
                                : summary._id,
                            )
                          }
                          disabled={isExporting}
                          className="text-sm px-4 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download size={16} />{" "}
                          {isExporting && openExportMenuId === summary._id
                            ? "Exporting..."
                            : t("summaries.export")}
                        </button>

                        {openExportMenuId === summary._id && (
                          <div className="absolute right-0 bottom-full mb-2 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-20 min-w-[140px]">
                            <button
                              onClick={() => {
                                handleExport(summary, "pdf");
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                            >
                              Export as PDF
                            </button>
                            <button
                              onClick={() => {
                                handleExport(summary, "docx");
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                            >
                              Export as DOCX
                            </button>
                            <button
                              onClick={() => {
                                handleExport(summary, "md");
                                setOpenExportMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                            >
                              Export as MD
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                currentPage={pagination.page || currentPage}
                totalPages={pagination.totalPages || 0}
                onPageChange={handlePageChange}
              />
            </>
          ) : (
            <div
              data-testid="summaries-empty-state"
              className="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700"
            >
              <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      <SummaryViewModal
        summary={viewModal}
        onClose={() => setViewModal(null)}
      />

      {/* Close menu when clicking outside */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  );
};

export default Summaries;
