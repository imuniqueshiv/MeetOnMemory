import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar.jsx";
import { meetingApi } from "../services";
import AppContent from "../context/AppContent";
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
} from "lucide-react";

/**
 * Summaries.jsx
 * ✅ Displays all stored meeting summaries
 * ✅ Supports both text and voice search
 * ✅ "View" button and modal fully functional
 */

const Summaries = () => {
  const { t } = useTranslation();
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [starredIds, setStarredIds] = useState([]);
  const [openExportMenuId, setOpenExportMenuId] = useState(null);
  const { exportMeeting, isExporting } = useExport();

  // 🎙️ Setup browser-based voice recognition
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

  // 🧠 Fetch all meeting summaries
  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const res = await meetingApi.getAllMeetings();

        if (res.data?.success) {
          setSummaries(res.data.meetings || []);
        } else {
          toast.error(res.data?.message || t("summaries.loadFailed"));
        }
      } catch (error) {
        console.error("Error fetching summaries:", error);
        toast.error(t("summaries.loadFailed"));
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
  }, [t]);

  // 🔍 Filter meetings by title or summary
  const filteredSummaries = summaries.filter(
    (m) =>
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.summary?.toLowerCase().includes(search.toLowerCase()),
  );

  // 📌 Sort meetings (Pinned > Starred > Default)
  const sortedSummaries = [...filteredSummaries].sort((a, b) => {
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

  // ❌ Delete meeting
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this meeting?"))
      return;

    try {
      const res = await meetingApi.deleteMeeting(id);

      if (res.data?.success) {
        setSummaries((prev) => prev.filter((s) => s._id !== id));
        setPinnedIds((prev) => prev.filter((pid) => pid !== id));
        setStarredIds((prev) => prev.filter((sid) => sid !== id));
        toast.success("Meeting deleted successfully");
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

          {/* 🔍 Search Bar with Voice + Text */}
          <div className="flex items-center justify-center mb-10">
            <div className="flex items-center w-full sm:w-[30rem] bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-full overflow-hidden hover:ring-2 hover:ring-blue-300 transition">
              <input
                type="text"
                placeholder={t("summaries.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-grow px-4 py-2 text-sm text-gray-700 focus:outline-none bg-transparent dark:text-gray-200"
              />
              {/* 🎤 Voice Search Button */}
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

              {/* Search Button */}
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-r-full hover:bg-blue-700 transition flex items-center gap-2"
                onClick={() => toast.info("Search updated")}
              >
                <Search size={16} /> {t("common.search")}
              </button>
            </div>
          </div>

          {/* Main Section */}
          {loading ? (
            <div className="flex justify-center items-center py-10 text-gray-500">
              <Loader2 className="animate-spin w-6 h-6 mr-2" /> {t("summaries.loading")}
            </div>
          ) : sortedSummaries.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
              {sortedSummaries.map((summary) => (
                <div
                  key={summary._id}
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
                      <MoreVertical size={20} className="text-gray-600 dark:text-gray-400" />
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
                          {starredIds.includes(summary._id) ? t("summaries.unstar") : t("summaries.star")}
                        </button>
                        <button
                          onClick={() => togglePin(summary._id)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                        >
                          <Pin size={16} />{" "}
                          {pinnedIds.includes(summary._id) ? t("summaries.unpin") : t("summaries.pin")}
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
          ) : (
            <div className="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">
                {t("summaries.noSummaries")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <FileText className="w-6 h-6 text-indigo-600" />
                {viewModal.title || t("aiSearch.untitledMeeting")}
              </h2>
              <button
                onClick={() => setViewModal(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
              >
                <X size={24} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-grow">
              <p className="text-sm text-gray-500 mb-4">
                <strong>{t("aiSearch.date")}:</strong>{" "}
                {viewModal.createdAt
                  ? new Date(viewModal.createdAt).toLocaleString()
                  : t("aiSearch.unknown")}
              </p>
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  {t("aiSearch.summary")}:
                </h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {viewModal.summary ||
                    viewModal.transcript ||
                    t("aiSearch.noSummary")}
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(viewModal.summary || viewModal.transcript || "");
                  toast.success(t("aiSearch.copiedToClipboard"));
                }}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Copy size={16} /> {t("summaries.copy")}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob(
                    [viewModal.summary || viewModal.transcript || ""],
                    { type: "text/plain;charset=utf-8" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${viewModal.title || "meeting"}_summary.txt`;
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
      )}

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
