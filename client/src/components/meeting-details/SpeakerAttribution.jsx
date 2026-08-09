import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Users, Check, X, Wand2, Trash2 } from "lucide-react";
import { speakerMappingApi } from "../../services/speakerMappingApi";

const SpeakerAttribution = ({ meetingId, participants }) => {
  const [mappings, setMappings] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newName, setNewName] = useState("");

  const fetchMappings = async () => {
    try {
      const response = await speakerMappingApi.getMappings(meetingId);
      setMappings(response.data.data);
    } catch (error) {
      console.error("Failed to load speaker mappings", error);
    }
  };

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const response = await speakerMappingApi.suggestMappings(meetingId);
      setSuggestions(response.data.data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (meetingId) {
      fetchMappings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const handleApply = async (originalLabel, mappedName) => {
    if (!originalLabel || !mappedName) return;
    try {
      await speakerMappingApi.saveAndApplyMapping(
        meetingId,
        originalLabel,
        mappedName,
      );
      toast.success("Mapping applied successfully");
      fetchMappings();
      // Clear inputs if it was a manual mapping
      if (newLabel === originalLabel) {
        setNewLabel("");
        setNewName("");
      }
      // Remove from suggestions
      setSuggestions(
        suggestions.filter((s) => s.originalLabel !== originalLabel),
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to apply mapping");
    }
  };

  const handleRevert = async (mappingId) => {
    try {
      await speakerMappingApi.revertMapping(meetingId, mappingId);
      toast.success("Mapping reverted");
      fetchMappings();
    } catch (error) {
      console.error(error);
      toast.error("Failed to revert mapping");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={20} />
          Speaker Attribution
        </h2>
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <Wand2 size={16} />
          {loading ? "Analyzing..." : "Auto-Suggest"}
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Map generic speaker labels (e.g., "Speaker A") to actual participants.
        This updates the transcript, summary, and action items globally.
      </p>

      {/* Manual Mapping Input */}
      <div className="flex gap-2 mb-6 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">
            Transcript Label
          </label>
          <input
            type="text"
            placeholder="e.g., Speaker A"
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Map To</label>
          <input
            type="text"
            placeholder="Participant Name"
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            list="participants-list-attribution"
          />
          <datalist id="participants-list-attribution">
            {participants?.map((p, i) => (
              <option key={i} value={p.name} />
            ))}
          </datalist>
        </div>
        <button
          onClick={() => handleApply(newLabel, newName)}
          disabled={!newLabel || !newName}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-md transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg">
          <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-3">
            Suggestions
          </h3>
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.originalLabel}
                className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border border-indigo-50 dark:border-indigo-900"
              >
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">
                    {suggestion.originalLabel}
                  </span>{" "}
                  might be{" "}
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                    {suggestion.options[0]?.name || "Unknown"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleApply(
                        suggestion.originalLabel,
                        suggestion.options[0]?.name,
                      )
                    }
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title="Accept suggestion"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() =>
                      setSuggestions(
                        suggestions.filter(
                          (s) => s.originalLabel !== suggestion.originalLabel,
                        ),
                      )
                    }
                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                    title="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Mappings */}
      {mappings.length > 0 ? (
        <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Original Label
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Mapped Name
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
              {mappings.map((mapping) => (
                <tr key={mapping._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {mapping.originalLabel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    {mapping.mappedName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleRevert(mapping._id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                      title="Revert mapping"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 text-sm">
          No mappings created yet.
        </div>
      )}
    </div>
  );
};

export default SpeakerAttribution;
