import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useContext,
} from "react";
import { personalNoteApi } from "../../services";
import { Pin, Save, CheckCircle, Highlighter, Trash2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { normalizeTranscript } from "../../utils/normalizeTranscript.js";
import AppContent from "../../context/AppContent";
import { useFormDraft } from "../../hooks/useFormDraft";
import PersonalNotesDraftRecoveryBanner from "./PersonalNotesDraftRecoveryBanner";

const PersonalNotes = ({ meeting }) => {
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // saving, saved, error
  const [annotations, setAnnotations] = useState([]);
  const [isPinning, setIsPinning] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(null);

  const context = useContext(AppContent) || {};
  const { userData } = context;

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [selectedTextData, setSelectedTextData] = useState(null);

  const lastSavedContentRef = useRef("");
  const containerRef = useRef(null);

  const draftKey = useMemo(() => {
    const userId = userData?._id || userData?.id || "anonymous";
    const meetingId = meeting?._id || meeting?.id;
    if (!meetingId) return null;
    return `meet-on-memory:personal-notes-draft:v1:${userId}:${meetingId}`;
  }, [userData, meeting]);

  const draftValues = useMemo(() => ({ content }), [content]);

  const restoreDraftValues = useCallback((draft) => {
    if (typeof draft?.content === "string") {
      setContent(draft.content);
    }
  }, []);

  const {
    recoverableDraft,
    isCheckComplete,
    restoreDraft,
    discardDraft,
    clearDraft,
  } = useFormDraft({
    key: draftKey,
    values: draftValues,
    enabled: Boolean(draftKey) && isLoaded,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    serverUpdatedAt,
    onRestore: restoreDraftValues,
  });

  // Proactively clear draft when content matches server's synced content
  useEffect(() => {
    if (
      isLoaded &&
      isCheckComplete &&
      !recoverableDraft &&
      content === lastSavedContentRef.current
    ) {
      clearDraft();
    }
  }, [content, isLoaded, isCheckComplete, recoverableDraft, clearDraft]);

  const normalizedSegments = useMemo(() => {
    return normalizeTranscript(meeting?.transcript);
  }, [meeting?.transcript]);

  const fetchNote = useCallback(async () => {
    if (!meeting?._id) return;
    try {
      const response = await personalNoteApi.getNoteByMeetingId(meeting._id);
      const noteData = response?.data?.note || response?.note;
      if (noteData) {
        const initialContent = noteData.content || "";
        setContent(initialContent);
        setIsPinned(noteData.isPinned || false);
        setAnnotations(noteData.annotations || []);
        lastSavedContentRef.current = initialContent;
        if (noteData.updatedAt) {
          setServerUpdatedAt(noteData.updatedAt);
        }
      }
    } catch (error) {
      console.error("Error fetching personal note", error);
    } finally {
      setIsLoaded(true);
    }
  }, [meeting?._id]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const saveContent = useCallback(
    async (newContent) => {
      if (!meeting?._id) return;
      setSaveStatus("saving");
      try {
        const response = await personalNoteApi.upsertNote(
          meeting._id,
          newContent,
        );
        const noteData = response?.data?.note || response?.note;
        lastSavedContentRef.current = newContent;
        setSaveStatus("saved");
        if (noteData?.updatedAt) {
          setServerUpdatedAt(noteData.updatedAt);
        }
      } catch (error) {
        console.error("Error saving note", error);
        setSaveStatus("error");
      }
    },
    [meeting?._id],
  );

  // Debounced auto-save (handles clearing notes & saving empty content)
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      if (content !== lastSavedContentRef.current) {
        saveContent(content);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [content, isLoaded, saveContent]);

  const togglePin = async () => {
    if (isPinning || !meeting?._id) return;
    setIsPinning(true);
    const newPinnedStatus = !isPinned;
    setIsPinned(newPinnedStatus);
    try {
      const response = await personalNoteApi.togglePin(
        meeting._id,
        newPinnedStatus,
      );
      const isPinnedResult =
        response?.isPinned ?? response?.data?.isPinned ?? newPinnedStatus;
      setIsPinned(isPinnedResult);
    } catch (error) {
      console.error("Error toggling pin", error);
      setIsPinned(!newPinnedStatus);
    } finally {
      setIsPinning(false);
    }
  };

  const handleClearNote = async () => {
    if (!meeting?._id) return;
    setSaveStatus("saving");
    try {
      await personalNoteApi.clearNoteContent(meeting._id);
      setContent("");
      lastSavedContentRef.current = "";
      setSaveStatus("saved");
    } catch (error) {
      console.error("Error clearing note", error);
      setSaveStatus("error");
    }
  };

  // Keyboard and Mouse Text Selection Logic
  const handleSelectionCheck = () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    if (text.length > 0 && containerRef.current) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setTooltipPosition({
        top: Math.max(10, rect.top - containerRect.top - 40),
        left: Math.max(
          10,
          rect.left - containerRect.left + rect.width / 2 - 50,
        ),
      });
      setTooltipVisible(true);
      setSelectedTextData({
        text,
        offsets: { start: range.startOffset, end: range.endOffset },
      });
    } else {
      setTooltipVisible(false);
    }
  };

  const handleHighlight = async () => {
    if (!selectedTextData || !meeting?._id) return;

    try {
      const annotationData = {
        annotationText: selectedTextData.text,
        sourceField: "transcript",
        offsets: selectedTextData.offsets,
        color: "#ffeb3b", // default yellow
      };

      const response = await personalNoteApi.addAnnotation(
        meeting._id,
        annotationData,
      );
      const updatedNote = response?.data?.note || response?.note;
      if (updatedNote?.annotations) {
        setAnnotations(updatedNote.annotations);
      }

      // Also append highlight quote to markdown notes
      const quoteText = `\n\n> ${selectedTextData.text}\n`;
      setContent((prev) => prev + quoteText);
    } catch (error) {
      console.error("Error adding highlight", error);
    } finally {
      setTooltipVisible(false);
      setSelectedTextData(null);
      if (window.getSelection()) {
        window.getSelection().removeAllRanges();
      }
    }
  };

  const handleRemoveAnnotation = async (annotationId) => {
    if (!meeting?._id || !annotationId) return;
    try {
      const response = await personalNoteApi.removeAnnotation(
        meeting._id,
        annotationId,
      );
      const updatedNote = response?.data?.note || response?.note;
      if (updatedNote?.annotations) {
        setAnnotations(updatedNote.annotations);
      } else {
        setAnnotations((prev) => prev.filter((a) => a._id !== annotationId));
      }
    } catch (error) {
      console.error("Error removing annotation", error);
    }
  };

  // Helper to render text with highlighted annotations
  const renderTextWithHighlights = (text) => {
    if (!annotations || annotations.length === 0 || !text) return text;

    const matchingAnnotations = annotations.filter(
      (ann) => ann.annotationText && text.includes(ann.annotationText),
    );

    if (matchingAnnotations.length === 0) return text;

    let parts = [text];
    matchingAnnotations.forEach((ann) => {
      const nextParts = [];
      parts.forEach((part) => {
        if (typeof part === "string" && part.includes(ann.annotationText)) {
          const subParts = part.split(ann.annotationText);
          subParts.forEach((sp, i) => {
            nextParts.push(sp);
            if (i < subParts.length - 1) {
              nextParts.push(
                <mark
                  key={`${ann._id || i}-${ann.annotationText}`}
                  className="bg-yellow-200 dark:bg-yellow-800/60 text-slate-900 dark:text-yellow-100 rounded px-1 py-0.5 font-medium"
                  title="Highlighted annotation"
                >
                  {ann.annotationText}
                </mark>,
              );
            }
          });
        } else {
          nextParts.push(part);
        }
      });
      parts = nextParts;
    });

    return parts;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden mb-6 flex flex-col md:flex-row min-h-[600px]">
      {/* LEFT: Transcript / Source Material */}
      <div
        ref={containerRef}
        tabIndex={0}
        aria-label="Meeting Transcript text content"
        className="relative md:w-1/2 border-r border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50 p-6 overflow-y-auto max-h-[600px] focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
        onMouseUp={handleSelectionCheck}
        onKeyUp={handleSelectionCheck}
      >
        <div className="flex items-center justify-between sticky top-0 bg-slate-50 dark:bg-gray-900/50 py-2 z-10 mb-4 border-b border-slate-200/60 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
            Meeting Transcript
          </h3>
          {selectedTextData && (
            <button
              onClick={handleHighlight}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded text-xs flex items-center shadow-sm transition-colors cursor-pointer"
            >
              <Highlighter className="w-3.5 h-3.5 mr-1" />
              Highlight Selection
            </button>
          )}
        </div>

        {tooltipVisible && (
          <div
            className="absolute z-20 bg-gray-900 text-white rounded-md shadow-lg flex items-center p-1 space-x-1"
            style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          >
            <button
              onClick={handleHighlight}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleHighlight();
                }
              }}
              tabIndex={0}
              aria-label="Highlight selected text"
              className="p-1.5 hover:bg-gray-700 focus:bg-gray-700 focus:outline-none rounded text-xs flex items-center cursor-pointer"
            >
              <Highlighter className="w-3.5 h-3.5 mr-1" />
              Highlight
            </button>
          </div>
        )}

        <div className="prose dark:prose-invert max-w-none text-sm text-slate-700 dark:text-gray-300">
          {normalizedSegments && normalizedSegments.length > 0 ? (
            normalizedSegments.map((t, idx) => (
              <p key={idx} className="mb-4">
                <span className="font-semibold text-slate-900 dark:text-white mr-2">
                  {t.speaker || "Speaker"}:
                </span>
                {renderTextWithHighlights(t.text)}
              </p>
            ))
          ) : (
            <p className="text-slate-500 italic">No transcript available.</p>
          )}
        </div>
      </div>

      {/* RIGHT: Markdown Editor */}
      <div className="md:w-1/2 p-6 flex flex-col max-h-[600px]">
        <PersonalNotesDraftRecoveryBanner
          savedAt={recoverableDraft?.savedAt}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
              My Private Notes
            </h3>
            <div className="flex items-center text-xs text-slate-500 dark:text-gray-400">
              {saveStatus === "saving" && (
                <span className="flex items-center text-amber-500">
                  <Save className="w-3 h-3 mr-1 animate-pulse" /> Saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center text-emerald-500">
                  <CheckCircle className="w-3 h-3 mr-1" /> Saved
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-red-500">Error saving</span>
              )}
              {annotations.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-[10px]">
                  {annotations.length} highlights
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {content && (
              <button
                onClick={handleClearNote}
                className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                title="Clear personal notes"
                aria-label="Clear personal notes"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={togglePin}
              disabled={isPinning}
              className={`p-2 rounded-full transition-colors ${isPinning ? "opacity-50 cursor-not-allowed" : ""} ${isPinned ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-slate-100 text-slate-400 hover:text-amber-500 dark:bg-gray-700"}`}
              title={isPinned ? "Unpin note" : "Pin note to dashboard"}
              aria-label={isPinned ? "Unpin note" : "Pin note to dashboard"}
            >
              <Pin className="w-4 h-4" />
            </button>
          </div>
        </div>

        {annotations.length > 0 && (
          <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-lg max-h-24 overflow-y-auto">
            <div className="text-[11px] font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
              Active Highlights ({annotations.length})
            </div>
            <div className="space-y-1">
              {annotations.map((ann, i) => (
                <div
                  key={ann._id || i}
                  className="flex items-center justify-between text-xs text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-1 px-2 rounded border border-yellow-200/60 dark:border-yellow-900/40"
                >
                  <span className="truncate max-w-[85%] font-mono text-[11px]">
                    "{ann.annotationText}"
                  </span>
                  <button
                    onClick={() => handleRemoveAnnotation(ann._id)}
                    className="text-slate-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                    title="Remove highlight"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setSaveStatus("saving");
            }}
            placeholder="Type your personal notes here using Markdown..."
            className="flex-1 w-full p-4 bg-slate-50 dark:bg-gray-900/50 border border-slate-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono dark:text-gray-200 mb-4"
          />
          <div className="flex-1 overflow-y-auto p-4 border border-slate-200 dark:border-gray-700 rounded-lg prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xs uppercase font-semibold text-slate-400 mb-2">
              Preview
            </h4>
            {content ? (
              <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
              <p className="text-slate-400 italic">Preview will appear here</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalNotes;
