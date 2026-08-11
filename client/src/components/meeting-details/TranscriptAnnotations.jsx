import React, { useState, useEffect, useContext, useRef } from "react";
import api from "../../services/apiClient";
import AppContent from "../../context/AppContent";
import {
  MessageSquare,
  Highlighter,
  Flag,
  Trash2,
  CheckCircle,
  Clock,
} from "lucide-react";
import { toast } from "react-toastify";

const TranscriptAnnotations = ({ meeting }) => {
  const { userData } = useContext(AppContent);
  const [transcript, setTranscript] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterResolved, setFilterResolved] = useState("all");

  // Selection state
  const [selection, setSelection] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const [newAnnotationType, setNewAnnotationType] = useState("comment");
  const [newAnnotationBody, setNewAnnotationBody] = useState("");
  const [newAnnotationColor, setNewAnnotationColor] = useState("#fbbf24");

  const containerRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [transcriptRes, annotationsRes] = await Promise.all([
          api
            .get(`/transcripts/meeting/${meeting._id}`)
            .catch(() => ({ data: null })),
          api
            .get(`/transcript-annotations/meeting/${meeting._id}`)
            .catch(() => ({ data: { annotations: [] } })),
        ]);

        if (transcriptRes.data) {
          setTranscript(transcriptRes.data);
        }
        if (annotationsRes.data?.annotations) {
          setAnnotations(annotationsRes.data.annotations);
        }
      } catch (error) {
        console.error("Error fetching data for annotations", error);
      } finally {
        setLoading(false);
      }
    };

    if (meeting?._id) {
      fetchData();
    }
  }, [meeting?._id]);

  const handleMouseUp = (segmentIndex, segment) => {
    const textSelection = window.getSelection();
    const text = textSelection.toString().trim();

    if (text && text.length > 0) {
      const range = textSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setSelection({
        text,
        segmentIndex,
        startTime: segment.startTime,
        endTime: segment.endTime,
      });

      setPopoverPosition({
        top: rect.bottom - containerRect.top + window.scrollY,
        left: rect.left - containerRect.left,
      });
    } else {
      setSelection(null);
      setPopoverPosition(null);
    }
  };

  const handleCreateAnnotation = async () => {
    if (!selection) return;
    if (
      (newAnnotationType === "comment" || newAnnotationType === "flag") &&
      !newAnnotationBody.trim()
    ) {
      toast.error("Please enter a note for your annotation");
      return;
    }

    try {
      const payload = {
        transcript: transcript._id,
        meeting: meeting._id,
        type: newAnnotationType,
        body: newAnnotationBody,
        color:
          newAnnotationType === "highlight" ? newAnnotationColor : undefined,
        startTime: selection.startTime,
        endTime: selection.endTime,
        segmentIndex: selection.segmentIndex,
      };

      const { data } = await api.post("/transcript-annotations", payload);
      if (data.success) {
        toast.success("Annotation added");
        setAnnotations([
          ...annotations,
          { ...data.annotation, author: userData },
        ]);
        setSelection(null);
        setPopoverPosition(null);
        setNewAnnotationBody("");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to create annotation",
      );
    }
  };

  const handleDeleteAnnotation = async (id) => {
    try {
      await api.delete(`/transcript-annotations/${id}`);
      setAnnotations(annotations.filter((a) => a._id !== id));
      toast.success("Annotation deleted");
    } catch {
      toast.error("Failed to delete annotation");
    }
  };

  const handleResolveAnnotation = async (id) => {
    try {
      const { data } = await api.patch(`/transcript-annotations/${id}/resolve`);
      if (data.success) {
        setAnnotations(
          annotations.map((a) =>
            a._id === id ? { ...a, resolved: data.annotation.resolved } : a,
          ),
        );
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading)
    return <div className="animate-pulse bg-gray-100 h-64 rounded-lg"></div>;
  if (!transcript || !transcript.segments || transcript.segments.length === 0)
    return null;

  const filteredAnnotations = annotations.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterResolved === "resolved" && !a.resolved) return false;
    if (filterResolved === "unresolved" && a.resolved) return false;
    return true;
  });

  const getIconForType = (type) => {
    switch (type) {
      case "comment":
        return <MessageSquare size={16} className="text-blue-500" />;
      case "highlight":
        return <Highlighter size={16} className="text-yellow-500" />;
      case "flag":
        return <Flag size={16} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
      ref={containerRef}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Transcript Annotations
        </h2>

        {/* Filter Toolbar */}
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="all">All Types</option>
            <option value="comment">Comments</option>
            <option value="highlight">Highlights</option>
            <option value="flag">Flags</option>
          </select>
          <select
            value={filterResolved}
            onChange={(e) => setFilterResolved(e.target.value)}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="all">All Status</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="flex gap-6 relative">
        {/* Transcript Segments Viewer */}
        <div className="flex-1 max-h-[600px] overflow-y-auto pr-4 relative space-y-4">
          {transcript.segments.map((segment, index) => {
            const segmentAnnotations = annotations.filter(
              (a) => a.segmentIndex === index,
            );
            const hasHighlight = segmentAnnotations.some(
              (a) => a.type === "highlight",
            );

            return (
              <div
                key={index}
                className={`p-3 rounded border border-transparent hover:bg-gray-50 transition-colors ${hasHighlight ? "bg-yellow-50" : ""}`}
                onMouseUp={() => handleMouseUp(index, segment)}
              >
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium text-indigo-600">
                    {segment.speaker || "Speaker"}
                  </span>
                  <span>
                    {Math.floor(segment.startTime / 60)}:
                    {(segment.startTime % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed">
                  {segment.text}
                </p>
              </div>
            );
          })}

          {/* Inline Creation Popover */}
          {popoverPosition && selection && (
            <div
              className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-64"
              style={{ top: popoverPosition.top, left: popoverPosition.left }}
            >
              <div className="flex gap-2 mb-2">
                <select
                  value={newAnnotationType}
                  onChange={(e) => setNewAnnotationType(e.target.value)}
                  className="w-full text-sm border-gray-300 rounded-md"
                >
                  <option value="comment">Comment</option>
                  <option value="highlight">Highlight</option>
                  <option value="flag">Flag</option>
                </select>
              </div>

              {newAnnotationType === "highlight" && (
                <div className="flex gap-2 mb-2">
                  {["#fbbf24", "#34d399", "#60a5fa", "#f472b6"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewAnnotationColor(color)}
                      className={`w-6 h-6 rounded-full border-2 ${newAnnotationColor === color ? "border-gray-800" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}

              {(newAnnotationType === "comment" ||
                newAnnotationType === "flag") && (
                <textarea
                  value={newAnnotationBody}
                  onChange={(e) => setNewAnnotationBody(e.target.value)}
                  placeholder="Add your note..."
                  className="w-full text-sm border-gray-300 rounded-md mb-2"
                  rows={2}
                />
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setSelection(null);
                    setPopoverPosition(null);
                  }}
                  className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAnnotation}
                  className="text-xs px-2 py-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Annotation Cards Gutter */}
        <div className="w-80 border-l border-gray-200 pl-4 max-h-[600px] overflow-y-auto space-y-3">
          {filteredAnnotations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No annotations match filters.
            </p>
          ) : (
            filteredAnnotations.map((annotation) => (
              <div
                key={annotation._id}
                className={`p-3 border rounded-lg shadow-sm ${annotation.resolved ? "bg-gray-50 opacity-75" : "bg-white border-gray-200"}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1.5">
                    {getIconForType(annotation.type)}
                    <span className="text-xs font-medium text-gray-700">
                      {annotation.author?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} />
                    {Math.floor(annotation.startTime / 60)}:
                    {(annotation.startTime % 60).toString().padStart(2, "0")}
                  </div>
                </div>

                {annotation.body && (
                  <p className="text-sm text-gray-800 mb-3">
                    {annotation.body}
                  </p>
                )}

                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleResolveAnnotation(annotation._id)}
                    className={`text-xs flex items-center gap-1 ${annotation.resolved ? "text-green-600" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <CheckCircle size={14} />
                    {annotation.resolved ? "Resolved" : "Resolve"}
                  </button>

                  {(userData?.role === "admin" ||
                    userData?._id === annotation.author?._id) && (
                    <button
                      onClick={() => handleDeleteAnnotation(annotation._id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptAnnotations;
