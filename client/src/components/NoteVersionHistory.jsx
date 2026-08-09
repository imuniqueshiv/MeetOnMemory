import React, { useEffect, useState, useCallback, useRef, useId } from "react";
import { toast } from "react-toastify";
import { format } from "date-fns";
import apiClient from "../services/apiClient";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const NoteVersionHistory = ({ meetingId, field, onClose, onRestored }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(
        `/api/note-versions/${meetingId}/${field}/history`,
      );
      if (res.data.success) {
        setHistory(res.data.versions || []);
      }
    } catch (err) {
      toast.error("Failed to fetch version history");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [meetingId, field]);

  const fetchDiff = useCallback(async (versionId) => {
    try {
      setLoadingDiff(true);
      const res = await apiClient.get(
        `/api/note-versions/version/${versionId}/diff`,
      );
      if (res.data.success) {
        setDiffData(res.data.diff);
      }
    } catch (err) {
      toast.error("Failed to fetch diff");
      console.error(err);
    } finally {
      setLoadingDiff(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (selectedVersionId) {
      fetchDiff(selectedVersionId);
    } else {
      setDiffData(null);
    }
  }, [selectedVersionId, fetchDiff]);

  // Accessibility: Focus management & Escape key handling (#1338)
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
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

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [onClose]);

  const handleRestore = async () => {
    try {
      const res = await apiClient.post(
        `/api/note-versions/version/${selectedVersionId}/restore`,
      );
      if (res.data.success) {
        toast.success("Version restored successfully");
        setShowRestoreConfirm(false);
        if (onRestored) {
          onRestored(res.data.meeting);
        }
        fetchHistory();
      }
    } catch (err) {
      toast.error("Failed to restore version");
      console.error(err);
    }
  };

  const getSourceBadge = (source) => {
    switch (source) {
      case "ai_processing":
        return (
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 rounded-full text-xs font-medium">
            AI
          </span>
        );
      case "user_edit":
        return (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 rounded-full text-xs font-medium">
            User
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-full text-xs font-medium">
            System
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2
            id={titleId}
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            Version History -{" "}
            {field === "summary" ? "AI Summary" : "Collaborative Notes"}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close version history"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer rounded-md p-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: History List */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No previous versions found.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {history.map((ver, idx) => (
                  <li
                    key={ver._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedVersionId(ver._id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedVersionId(ver._id);
                      }
                    }}
                    className={`p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      selectedVersionId === ver._id
                        ? "bg-blue-50 dark:bg-blue-900/30"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        Version {ver.version} {idx === 0 && "(Latest)"}
                      </span>
                      {getSourceBadge(ver.changeSource)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {format(new Date(ver.createdAt), "MMM d, yyyy h:mm a")}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {ver.changedBy ? ver.changedBy.name : "System"}
                      {" • "}
                      <span
                        className={
                          ver.bytesDiff > 0
                            ? "text-green-500"
                            : ver.bytesDiff < 0
                              ? "text-red-500"
                              : ""
                        }
                      >
                        {ver.bytesDiff > 0 ? "+" : ""}
                        {ver.bytesDiff} bytes
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Main Area: Diff Viewer */}
          <div className="flex-1 bg-white dark:bg-gray-800 overflow-y-auto flex flex-col relative">
            {!selectedVersionId ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                Select a version to view changes
              </div>
            ) : loadingDiff ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                Loading diff...
              </div>
            ) : diffData ? (
              <div className="p-4 flex-1">
                <div className="flex justify-end mb-4">
                  <button
                    type="button"
                    onClick={() => setShowRestoreConfirm(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer font-medium"
                  >
                    Restore this version
                  </button>
                </div>
                <div className="font-mono text-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 whitespace-pre-wrap">
                  {diffData.map((part, index) => {
                    const colorClass = part.added
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      : part.removed
                        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 line-through"
                        : "text-gray-800 dark:text-gray-200";

                    return (
                      <span key={index} className={colorClass}>
                        {part.value}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex justify-center items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm restore version"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Confirm Restore
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              Are you sure you want to restore this version? This will overwrite
              the current content and create a new version snapshot.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium cursor-pointer"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteVersionHistory;
