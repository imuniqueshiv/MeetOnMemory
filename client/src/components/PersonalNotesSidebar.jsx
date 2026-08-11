import React, { useState, useEffect } from "react";
import {
  Pin,
  PinOff,
  Save,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { personalNoteApi } from "../services";

/**
 * PersonalNotesSidebar - Note editor with live character counters
 *
 * Features:
 * - Live character counting for title and content
 * - Visual warnings when approaching limits
 * - Auto-save with debouncing
 * - Pin/unpin functionality
 * - Annotation display
 *
 * Character Limits:
 * - Title: 200 characters
 * - Content: 50,000 characters
 */
const PersonalNotesSidebar = ({ meetingId, isOpen }) => {
  const [note, setNote] = useState({
    title: "",
    content: "",
    isPinned: false,
    annotations: [],
  });
  const [originalNote, setOriginalNote] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle, saving, saved, error
  const [isClearing, setIsClearing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Character limits (matching backend)
  const LIMITS = {
    MAX_TITLE_LENGTH: 200,
    MAX_CONTENT_LENGTH: 50000,
  };

  /**
   * Calculate character count and percentage for progress indicators
   */
  const getCharStats = (text, maxLength) => {
    const count = text?.length || 0;
    const percentage = (count / maxLength) * 100;
    const remaining = maxLength - count;

    let status = "normal";
    if (percentage >= 90) status = "critical";
    else if (percentage >= 75) status = "warning";

    return { count, percentage, remaining, status };
  };

  const titleStats = getCharStats(note.title, LIMITS.MAX_TITLE_LENGTH);
  const contentStats = getCharStats(note.content, LIMITS.MAX_CONTENT_LENGTH);

  /**
   * Fetch note data when component mounts or meetingId changes
   */
  useEffect(() => {
    const fetchNote = async () => {
      if (!meetingId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await personalNoteApi.getByMeetingId(meetingId);

        if (response.success) {
          const noteData = {
            title: response.note.title || "",
            content: response.note.content || "",
            isPinned: response.note.isPinned || false,
            annotations: response.note.annotations || [],
          };

          setNote(noteData);
          setOriginalNote(noteData);
        }
      } catch (err) {
        console.error("Error fetching note:", err);
        setError("Failed to load notes");
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchNote();
    }
  }, [meetingId, isOpen]);

  // Destructure to satisfy exhaustive-deps without causing infinite re-render loops
  const { title: noteTitle, content: noteContent } = note;

  /**
   * Auto-save note content with debouncing (1 second delay)
   */
  useEffect(() => {
    if (!meetingId || isLoading || isClearing || isDeleting) return;

    // Check if note has changed from original
    const hasChanged =
      noteTitle !== originalNote?.title ||
      noteContent !== originalNote?.content;

    if (!hasChanged) {
      setSaveStatus("idle");
      return;
    }

    setSaveStatus("saving");

    const timeoutId = setTimeout(async () => {
      try {
        setIsSaving(true);

        const response = await personalNoteApi.upsertNote(meetingId, {
          title: noteTitle,
          content: noteContent,
        });

        if (response.success) {
          // Use functional update to avoid needing 'note' in dependency array
          setOriginalNote((prev) => ({
            ...prev,
            title: noteTitle,
            content: noteContent,
          }));
          setSaveStatus("saved");

          // Reset to idle after 2 seconds
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          setError(response.message || "Failed to save note");
        }
      } catch (err) {
        console.error("Error saving note:", err);
        setSaveStatus("error");
        setError("Failed to save note");
      } finally {
        setIsSaving(false);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [
    noteTitle,
    noteContent,
    meetingId,
    isLoading,
    originalNote,
    isClearing,
    isDeleting,
  ]);

  /**
   * Toggle pin status of the note
   */
  const handleTogglePin = async () => {
    try {
      const response = await personalNoteApi.togglePin(meetingId);
      if (response.success) {
        setNote((prev) => ({ ...prev, isPinned: response.isPinned }));
      }
    } catch (err) {
      console.error("Error toggling pin:", err);
      setError("Failed to update pin status");
    }
  };

  /**
   * Handle clearing note content (title and text content)
   */
  const handleClearContent = async () => {
    if (
      window.confirm(
        "Are you sure you want to clear this note's title and content? Your annotations and pin status will be kept.",
      )
    ) {
      setIsClearing(true);
      setError(null);
      try {
        const response = await personalNoteApi.clearNoteContent(meetingId);
        if (response.success) {
          const clearedData = {
            title: "",
            content: "",
            isPinned: note.isPinned,
            annotations: note.annotations,
          };
          setNote(clearedData);
          setOriginalNote(clearedData);
          setSaveStatus("idle");
        } else {
          setError(response.message || "Failed to clear note content");
        }
      } catch (err) {
        console.error("Error clearing note content:", err);
        setError("Failed to clear note content");
      } finally {
        setIsClearing(false);
      }
    }
  };

  /**
   * Handle deleting the note document entirely
   */
  const handleDeleteNote = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this personal note entirely from the database? This action is irreversible.",
      )
    ) {
      setIsDeleting(true);
      setError(null);
      try {
        const response = await personalNoteApi.deleteNote(meetingId);
        if (response.success) {
          const deletedData = {
            title: "",
            content: "",
            isPinned: false,
            annotations: [],
          };
          setNote(deletedData);
          setOriginalNote(deletedData);
          setSaveStatus("idle");
        } else {
          setError(response.message || "Failed to delete note");
        }
      } catch (err) {
        console.error("Error deleting note:", err);
        setError("Failed to delete note");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  /**
   * Handle title input changes with validation
   */
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;

    // Prevent exceeding limit
    if (newTitle.length <= LIMITS.MAX_TITLE_LENGTH) {
      setNote((prev) => ({ ...prev, title: newTitle }));
    }
  };

  /**
   * Handle content input changes with validation
   */
  const handleContentChange = (e) => {
    const newContent = e.target.value;

    // Prevent exceeding limit
    if (newContent.length <= LIMITS.MAX_CONTENT_LENGTH) {
      setNote((prev) => ({ ...prev, content: newContent }));
    }
  };

  /**
   * Get color class based on character count status
   */
  const getStatusColor = (status) => {
    switch (status) {
      case "critical":
        return "text-red-600 dark:text-red-400";
      case "warning":
        return "text-amber-600 dark:text-amber-400";
      default:
        return "text-gray-500 dark:text-gray-400";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Personal Notes
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Status Indicator */}
          {saveStatus === "saving" && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {saveStatus === "saved" && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Save className="w-3 h-3" />
              <span>Saved</span>
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3 h-3" />
              <span>Error</span>
            </div>
          )}

          {/* Pin Toggle Button */}
          <button
            onClick={handleTogglePin}
            className={`p-2 rounded-lg transition-colors ${
              note.isPinned
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            aria-label={note.isPinned ? "Unpin note" : "Pin note"}
            title={note.isPinned ? "Unpin note" : "Pin note"}
          >
            {note.isPinned ? (
              <PinOff className="w-4 h-4" />
            ) : (
              <Pin className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Note Editor */}
      {!isLoading && !error && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title Input */}
          <div>
            <label
              htmlFor="note-title"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Title
            </label>
            <input
              id="note-title"
              type="text"
              value={note.title}
              onChange={handleTitleChange}
              placeholder="Enter note title..."
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 ${
                titleStats.status === "critical"
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
              maxLength={LIMITS.MAX_TITLE_LENGTH}
              disabled={isSaving}
            />

            {/* Character Counter for Title */}
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs ${getStatusColor(titleStats.status)}`}>
                {titleStats.count} / {LIMITS.MAX_TITLE_LENGTH} characters
              </span>
              {titleStats.status !== "normal" && (
                <span
                  className={`text-xs ${getStatusColor(titleStats.status)}`}
                >
                  {titleStats.remaining} remaining
                </span>
              )}
            </div>

            {/* Progress Bar for Title */}
            <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  titleStats.status === "critical"
                    ? "bg-red-500"
                    : titleStats.status === "warning"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                }`}
                style={{ width: `${titleStats.percentage}%` }}
              />
            </div>
          </div>

          {/* Content Textarea */}
          <div>
            <label
              htmlFor="note-content"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Content
            </label>
            <textarea
              id="note-content"
              value={note.content}
              onChange={handleContentChange}
              placeholder="Start typing your notes..."
              rows={15}
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 resize-none ${
                contentStats.status === "critical"
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
              maxLength={LIMITS.MAX_CONTENT_LENGTH}
              disabled={isSaving}
            />

            {/* Character Counter for Content */}
            <div className="flex items-center justify-between mt-1">
              <span
                className={`text-xs ${getStatusColor(contentStats.status)}`}
              >
                {contentStats.count.toLocaleString()} /{" "}
                {LIMITS.MAX_CONTENT_LENGTH.toLocaleString()} characters
              </span>
              {contentStats.status !== "normal" && (
                <span
                  className={`text-xs ${getStatusColor(contentStats.status)}`}
                >
                  {contentStats.remaining.toLocaleString()} remaining
                </span>
              )}
            </div>

            {/* Progress Bar for Content */}
            <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  contentStats.status === "critical"
                    ? "bg-red-500"
                    : contentStats.status === "warning"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                }`}
                style={{ width: `${Math.min(contentStats.percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Annotations Section */}
          {note.annotations && note.annotations.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Annotations ({note.annotations.length})
              </h3>
              <div className="space-y-2">
                {note.annotations.map((annotation, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    style={{
                      borderLeftColor: annotation.color,
                      borderLeftWidth: "3px",
                    }}
                  >
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      {annotation.annotationText}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                      {annotation.sourceField} · {annotation.offsets.start}-
                      {annotation.offsets.end}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Destructive Actions Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex gap-2">
            <button
              onClick={handleClearContent}
              disabled={isSaving || isClearing || isDeleting}
              className="flex-1 px-3 py-2 text-xs font-semibold text-amber-700 hover:text-white border border-amber-300 hover:bg-amber-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearing ? "Clearing..." : "Clear Content"}
            </button>
            <button
              onClick={handleDeleteNote}
              disabled={isSaving || isClearing || isDeleting}
              className="flex-1 px-3 py-2 text-xs font-semibold text-red-700 hover:text-white border border-red-300 hover:bg-red-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Deleting..." : "Delete Note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalNotesSidebar;
