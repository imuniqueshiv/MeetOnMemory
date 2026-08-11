import React, { useCallback, useEffect, useState } from "react";
import {
  generateAgendaSuggestions,
  updateSuggestionItemStatus,
  applySuggestionToMeeting,
  getMeetingSuggestions,
} from "../../services/agendaSuggestionApi";

const SmartAgendaGenerator = ({
  organizationId,
  meetingId,
  onApplySuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editText, setEditText] = useState("");

  const loadExistingSuggestions = useCallback(async () => {
    try {
      const data = await getMeetingSuggestions(meetingId);
      if (data && data.length > 0) {
        setSuggestions(data[0]); // Load the most recent generation
      }
    } catch (error) {
      console.error("Failed to load existing suggestions:", error);
    }
  }, [meetingId]);

  useEffect(() => {
    if (meetingId) {
      loadExistingSuggestions();
    }
  }, [loadExistingSuggestions, meetingId]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateAgendaSuggestions(organizationId, meetingId);
      setSuggestions(data);
    } catch (error) {
      console.error("Failed to generate agenda:", error);
      alert("Error generating agenda suggestions.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (itemId, status, text = null) => {
    if (!suggestions) return;
    try {
      const updated = await updateSuggestionItemStatus(
        suggestions._id,
        itemId,
        status,
        text,
      );
      setSuggestions(updated);
      setEditingItemId(null);
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleApply = async () => {
    if (!suggestions) return;
    try {
      if (meetingId) {
        await applySuggestionToMeeting(suggestions._id, meetingId);
      }
      if (onApplySuccess) {
        const itemsToApply = suggestions.suggestions.filter(
          (s) => s.status === "accepted" || s.status === "edited",
        );
        onApplySuccess(itemsToApply);
      }
    } catch (error) {
      console.error("Failed to apply suggestions:", error);
      alert("Error applying agenda suggestions.");
    }
  };

  // Removed strict organizationId check to allow backend to resolve it via session

  if (loading) {
    return (
      <div className="p-6 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center space-x-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-blue-700 dark:text-blue-300 font-medium">
          Analyzing past meetings and organization context...
        </span>
      </div>
    );
  }

  if (!suggestions) {
    return (
      <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          ✨ Smart Agenda Generator
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Automatically suggest an agenda based on open action items, deferred
          decisions, and recent topics.
        </p>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow transition-colors"
        >
          Generate Agenda
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border border-indigo-200 dark:border-indigo-900 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <span className="mr-2">✨</span> AI Agenda Suggestions
        </h3>
        <button
          onClick={handleGenerate}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Regenerate
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {suggestions.suggestions.map((item) => (
          <div
            key={item._id}
            className={`p-4 border rounded-md ${
              item.status === "accepted" || item.status === "edited"
                ? "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
                : item.status === "rejected"
                  ? "border-gray-200 bg-gray-50 opacity-60 dark:bg-gray-800 dark:border-gray-700"
                  : "border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700"
            }`}
          >
            {editingItemId === item._id ? (
              <div className="flex flex-col space-y-2">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="px-3 py-2 border rounded text-sm w-full dark:bg-gray-700 dark:border-gray-600"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setEditingItemId(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      handleUpdateStatus(item._id, "edited", editText)
                    }
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {item.status === "edited" ? item.acceptedText : item.text}
                  </h4>
                  <div className="flex items-center space-x-2">
                    {item.status === "pending" && (
                      <>
                        <button
                          onClick={() =>
                            handleUpdateStatus(item._id, "accepted")
                          }
                          className="text-green-600 hover:text-green-700 p-1"
                          title="Accept"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingItemId(item._id);
                            setEditText(item.text);
                          }}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() =>
                            handleUpdateStatus(item._id, "rejected")
                          }
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Reject"
                        >
                          ✕
                        </button>
                      </>
                    )}
                    {(item.status === "accepted" ||
                      item.status === "edited" ||
                      item.status === "rejected") && (
                      <button
                        onClick={() => handleUpdateStatus(item._id, "pending")}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {item.description}
                </p>
                <div className="flex items-center text-xs space-x-3">
                  <span className="text-gray-500 dark:text-gray-500">
                    ⏱ {item.estimatedDuration} min
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full font-medium">
                    {item.source.title || "AI Suggestion"}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleApply}
          disabled={suggestions.appliedAt !== null}
          className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded shadow transition-colors"
        >
          {suggestions.appliedAt !== null
            ? "Applied to Meeting"
            : "Apply to Agenda"}
        </button>
      </div>
    </div>
  );
};

export default SmartAgendaGenerator;
