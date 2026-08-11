import React, { useState, useEffect, useRef, useCallback } from "react";
import { personalNoteApi } from "../../services";
import { Pin, Save, CheckCircle, Highlighter } from "lucide-react";
import ReactMarkdown from "react-markdown";

const PersonalNotes = ({ meeting }) => {
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // saving, saved, error
  const [annotations, setAnnotations] = useState([]);

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [selectedTextData, setSelectedTextData] = useState(null);

  const containerRef = useRef(null);

  const fetchNote = useCallback(async () => {
    try {
      const { data } = await personalNoteApi.getNoteByMeetingId(meeting._id);
      if (data.success && data.note) {
        setContent(data.note.content || "");
        setIsPinned(data.note.isPinned || false);
        setAnnotations(data.note.annotations || []);
      }
    } catch (error) {
      console.error("Error fetching personal note", error);
    }
  }, [meeting._id]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const saveContent = useCallback(
    async (newContent) => {
      setSaveStatus("saving");
      try {
        await personalNoteApi.upsertNote(meeting._id, newContent);
        setSaveStatus("saved");
      } catch (error) {
        console.error("Error saving note", error);
        setSaveStatus("error");
      }
    },
    [meeting._id],
  );

  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== "") {
        saveContent(content);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [content, saveContent]);

  const togglePin = async () => {
    const newPinnedStatus = !isPinned;
    setIsPinned(newPinnedStatus);
    try {
      await personalNoteApi.togglePin(meeting._id, newPinnedStatus);
    } catch (error) {
      console.error("Error toggling pin", error);
      setIsPinned(!newPinnedStatus); // revert on error
    }
  };

  // Text Selection Logic
  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setTooltipPosition({
        top: rect.top - containerRect.top - 40,
        left: rect.left - containerRect.left + rect.width / 2 - 50,
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
    if (!selectedTextData) return;

    try {
      const annotationData = {
        annotationText: selectedTextData.text,
        sourceField: "transcript",
        offsets: selectedTextData.offsets,
        color: "#ffeb3b", // default yellow
      };

      const { data } = await personalNoteApi.addAnnotation(
        meeting._id,
        annotationData,
      );
      if (data.success && data.note) {
        setAnnotations(data.note.annotations);
        // Also append to markdown notes for quick reference
        const newContent = content + `\n\n> ${selectedTextData.text}\n`;
        setContent(newContent);
      }
    } catch (error) {
      console.error("Error adding highlight", error);
    } finally {
      setTooltipVisible(false);
      window.getSelection().removeAllRanges();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden mb-6 flex flex-col md:flex-row min-h-[600px]">
      {/* LEFT: Transcript / Source Material */}
      <div
        ref={containerRef}
        className="relative md:w-1/2 border-r border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50 p-6 overflow-y-auto max-h-[600px]"
        onMouseUp={handleMouseUp}
      >
        <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100 mb-4 sticky top-0 bg-slate-50 dark:bg-gray-900/50 py-2 z-10">
          Meeting Transcript
        </h3>

        {tooltipVisible && (
          <div
            className="absolute z-20 bg-gray-900 text-white rounded-md shadow-lg flex items-center p-1 space-x-1"
            style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          >
            <button
              onClick={handleHighlight}
              className="p-1.5 hover:bg-gray-700 rounded text-xs flex items-center"
            >
              <Highlighter className="w-3 h-3 mr-1" />
              Highlight
            </button>
          </div>
        )}

        <div className="prose dark:prose-invert max-w-none text-sm text-slate-700 dark:text-gray-300">
          {meeting.transcript && meeting.transcript.length > 0 ? (
            meeting.transcript.map((t, idx) => (
              <p key={idx} className="mb-4">
                <span className="font-semibold text-slate-900 dark:text-white mr-2">
                  {t.speaker || "Speaker"}:
                </span>
                {/* Basic rendering. For actual highlighted regions, more complex logic is needed to wrap text ranges */}
                {t.text}
              </p>
            ))
          ) : (
            <p className="text-slate-500 italic">No transcript available.</p>
          )}
        </div>
      </div>

      {/* RIGHT: Markdown Editor */}
      <div className="md:w-1/2 p-6 flex flex-col max-h-[600px]">
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
          <button
            onClick={togglePin}
            className={`p-2 rounded-full transition-colors ${isPinned ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-slate-100 text-slate-400 hover:text-amber-500 dark:bg-gray-700"}`}
            title={isPinned ? "Unpin note" : "Pin note to dashboard"}
          >
            <Pin className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col">
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
