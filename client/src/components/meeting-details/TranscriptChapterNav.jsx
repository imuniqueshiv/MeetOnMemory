import React, { useState, useEffect } from "react";
import {
  Clock,
  Edit2,
  Trash2,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as chapterApi from "../../api/transcriptChapterApi";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const TranscriptChapterNav = ({
  meetingId,
  onChapterClick,
  currentTimestamp,
}) => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const fetchChapters = async () => {
      try {
        setLoading(true);
        const data = await chapterApi.getChapters(meetingId);
        if (data.success) setChapters(data.chapters || []);
      } catch (error) {
        console.error("Failed to fetch chapters:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchChapters();
  }, [meetingId]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const data = await chapterApi.generateChapters(meetingId);
      if (data.success) setChapters(data.chapters || []);
    } catch (error) {
      console.error("Failed to generate chapters:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      const data = await chapterApi.deleteChapter(meetingId, id);
      if (data.success) setChapters(data.chapters || []);
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  };

  const startEdit = (chapter, e) => {
    e.stopPropagation();
    setEditingId(chapter._id || "new");
    setEditForm({ ...chapter });
  };

  const saveEdit = async () => {
    try {
      let data;
      if (editingId === "new") {
        data = await chapterApi.addChapter(meetingId, editForm);
      } else {
        data = await chapterApi.updateChapter(meetingId, editingId, editForm);
      }
      if (data.success) {
        setChapters(data.chapters || []);
        setEditingId(null);
      }
    } catch (error) {
      console.error("Failed to save chapter:", error);
    }
  };

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 bg-gray-100 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" /> Chapters
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingId("new");
              setEditForm({ title: "New Chapter", startTime: 0, endTime: 0 });
            }}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Add Manual Chapter"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors disabled:opacity-50"
            title="Auto-Generate Chapters"
          >
            <Sparkles
              className={`w-4 h-4 ${generating ? "animate-pulse text-purple-600" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {editingId === "new" && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <input
              type="text"
              className="w-full text-sm border-gray-300 rounded p-1"
              value={editForm.title}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
              placeholder="Chapter Title"
            />
            <div className="flex gap-2">
              <input
                type="number"
                className="w-1/2 text-sm border-gray-300 rounded p-1"
                value={editForm.startTime}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    startTime: Number(e.target.value),
                  })
                }
                placeholder="Start (s)"
              />
              <input
                type="number"
                className="w-1/2 text-sm border-gray-300 rounded p-1"
                value={editForm.endTime}
                onChange={(e) =>
                  setEditForm({ ...editForm, endTime: Number(e.target.value) })
                }
                placeholder="End (s)"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingId(null)}
                className="text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {chapters.length === 0 && editingId !== "new" ? (
          <div className="text-center py-8 px-4 text-gray-500 text-sm">
            <p>No chapters yet.</p>
            <p className="mt-1">
              Click the sparkles icon to auto-generate from the transcript.
            </p>
          </div>
        ) : (
          chapters.map((chapter) => {
            const isEditing = editingId === chapter._id;
            const isExpanded = expandedId === chapter._id;
            const isActive =
              currentTimestamp >= chapter.startTime &&
              currentTimestamp <= chapter.endTime;

            if (isEditing) {
              return (
                <div
                  key={chapter._id}
                  className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2"
                >
                  <input
                    type="text"
                    className="w-full text-sm border-gray-300 rounded p-1"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="w-1/2 text-sm border-gray-300 rounded p-1"
                      value={editForm.startTime}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          startTime: Number(e.target.value),
                        })
                      }
                    />
                    <input
                      type="number"
                      className="w-1/2 text-sm border-gray-300 rounded p-1"
                      value={editForm.endTime}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          endTime: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={chapter._id}
                onClick={() =>
                  onChapterClick && onChapterClick(chapter.startTime)
                }
                className={`p-3 rounded-lg border transition-all cursor-pointer group ${
                  isActive
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-xs font-medium text-blue-600 block mb-1">
                      {formatTime(chapter.startTime)} -{" "}
                      {formatTime(chapter.endTime)}
                    </span>
                    <h4
                      className={`text-sm font-semibold ${isActive ? "text-blue-900" : "text-gray-800"}`}
                    >
                      {chapter.title}
                    </h4>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEdit(chapter, e)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(chapter._id, e)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {chapter.summary && (
                  <div className="mt-2">
                    <button
                      onClick={(e) => toggleExpand(chapter._id, e)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      {isExpanded ? "Hide details" : "Show details"}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2 text-xs text-gray-600">
                        <p>{chapter.summary}</p>
                        {chapter.keyQuotes && chapter.keyQuotes.length > 0 && (
                          <div className="pl-2 border-l-2 border-blue-200 italic">
                            "{chapter.keyQuotes[0]}"
                          </div>
                        )}
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                            chapter.sentiment === "POSITIVE"
                              ? "bg-green-100 text-green-700"
                              : chapter.sentiment === "NEGATIVE"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {chapter.sentiment}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TranscriptChapterNav;
