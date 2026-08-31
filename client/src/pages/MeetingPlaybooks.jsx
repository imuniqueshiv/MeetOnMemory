import React, { useState, useEffect } from "react";
import {
  fetchPlaybooks,
  generateAIPlaybook,
  updatePlaybook,
  deletePlaybook,
  restorePlaybookVersion,
  applyPlaybookToMeeting,
} from "../api/meetingPlaybookApi";
import { meetingApi } from "../services/meetingApi";
import {
  Bot,
  Trash2,
  Edit2,
  History,
  CalendarCheck,
  Plus,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  X,
  Layers,
} from "lucide-react";
import { toast } from "react-toastify";

const MeetingPlaybooks = () => {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [meetingType, setMeetingType] = useState("");
  const [prompt, setPrompt] = useState("");

  // Step Editor modal state
  const [editingPlaybook, setEditingPlaybook] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Version History modal state
  const [versionHistoryPlaybook, setVersionHistoryPlaybook] = useState(null);
  const [restoringVersion, setRestoringVersion] = useState(false);

  // Apply to Meeting modal state
  const [applyingPlaybook, setApplyingPlaybook] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [submittingApply, setSubmittingApply] = useState(false);

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybooks = async () => {
    setLoading(true);
    try {
      const data = await fetchPlaybooks();
      setPlaybooks(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load playbooks");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async (e) => {
    e.preventDefault();
    if (!meetingType || !prompt) {
      toast.error("Please fill in all fields");
      return;
    }
    setGenerating(true);
    try {
      const newPlaybook = await generateAIPlaybook(prompt, meetingType);
      toast.success("Playbook generated successfully!");
      setPlaybooks([newPlaybook, ...playbooks]);
      setMeetingType("");
      setPrompt("");
    } catch {
      toast.error("Failed to generate playbook via AI");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this playbook?"))
      return;
    try {
      await deletePlaybook(id);
      toast.success("Playbook deleted");
      setPlaybooks(playbooks.filter((p) => p._id !== id));
    } catch {
      toast.error("Failed to delete playbook");
    }
  };

  // Step Editor Functions
  const handleOpenEditor = (playbook) => {
    setEditingPlaybook({
      ...playbook,
      steps: (playbook.steps || []).map((s) => ({
        title: s.title || "",
        durationMinutes: s.durationMinutes || 5,
        facilitatorPrompts: Array.isArray(s.facilitatorPrompts)
          ? [...s.facilitatorPrompts]
          : [],
        expectedOutputs: Array.isArray(s.expectedOutputs)
          ? [...s.expectedOutputs]
          : [],
      })),
    });
  };

  const handleAddStep = () => {
    if (!editingPlaybook) return;
    setEditingPlaybook({
      ...editingPlaybook,
      steps: [
        ...editingPlaybook.steps,
        {
          title: "New Step",
          durationMinutes: 10,
          facilitatorPrompts: [""],
          expectedOutputs: [""],
        },
      ],
    });
  };

  const handleRemoveStep = (index) => {
    if (!editingPlaybook) return;
    const newSteps = editingPlaybook.steps.filter((_, i) => i !== index);
    setEditingPlaybook({ ...editingPlaybook, steps: newSteps });
  };

  const handleMoveStep = (index, direction) => {
    if (!editingPlaybook) return;
    const newSteps = [...editingPlaybook.steps];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    setEditingPlaybook({ ...editingPlaybook, steps: newSteps });
  };

  const handleStepChange = (index, field, value) => {
    if (!editingPlaybook) return;
    const newSteps = [...editingPlaybook.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setEditingPlaybook({ ...editingPlaybook, steps: newSteps });
  };

  const handlePromptChange = (stepIdx, promptIdx, value) => {
    if (!editingPlaybook) return;
    const newSteps = [...editingPlaybook.steps];
    const prompts = [...(newSteps[stepIdx].facilitatorPrompts || [])];
    prompts[promptIdx] = value;
    newSteps[stepIdx].facilitatorPrompts = prompts;
    setEditingPlaybook({ ...editingPlaybook, steps: newSteps });
  };

  const handleAddPrompt = (stepIdx) => {
    if (!editingPlaybook) return;
    const newSteps = [...editingPlaybook.steps];
    newSteps[stepIdx].facilitatorPrompts = [
      ...(newSteps[stepIdx].facilitatorPrompts || []),
      "",
    ];
    setEditingPlaybook({ ...editingPlaybook, steps: newSteps });
  };

  const handleRemovePrompt = (stepIdx, promptIdx) => {
    if (!editingPlaybook) return;
    const newSteps = [...editingPlaybook.steps];
    newSteps[stepIdx].facilitatorPrompts = newSteps[
      stepIdx
    ].facilitatorPrompts.filter((_, i) => i !== promptIdx);
    setEditingPlaybook({ ...editingPlaybook, steps: newSteps });
  };

  const handleSavePlaybookEdits = async (e) => {
    e.preventDefault();
    if (!editingPlaybook.name.trim()) {
      toast.error("Playbook name is required");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updatePlaybook(editingPlaybook._id, {
        name: editingPlaybook.name,
        description: editingPlaybook.description,
        steps: editingPlaybook.steps,
      });
      toast.success(`Playbook updated to version ${updated.version || 2}!`);
      setPlaybooks(playbooks.map((p) => (p._id === updated._id ? updated : p)));
      setEditingPlaybook(null);
    } catch {
      toast.error("Failed to save playbook changes");
    } finally {
      setSavingEdit(false);
    }
  };

  // Version History & Restore Functions
  const handleOpenVersionHistory = (playbook) => {
    setVersionHistoryPlaybook(playbook);
  };

  const handleRestoreVersion = async (playbookId, versionNumber) => {
    if (
      !window.confirm(
        `Restore version ${versionNumber}? This will create a new version snapshot.`,
      )
    ) {
      return;
    }
    setRestoringVersion(true);
    try {
      const restored = await restorePlaybookVersion(playbookId, versionNumber);
      toast.success(
        `Restored version ${versionNumber} as active version ${restored.version}!`,
      );
      setPlaybooks(
        playbooks.map((p) => (p._id === restored._id ? restored : p)),
      );
      setVersionHistoryPlaybook(restored);
    } catch {
      toast.error("Failed to restore version");
    } finally {
      setRestoringVersion(false);
    }
  };

  // Apply to Meeting Functions
  const handleOpenApplyModal = async (playbook) => {
    setApplyingPlaybook(playbook);
    setSelectedMeetingId("");
    setLoadingMeetings(true);
    try {
      const res = await meetingApi.getAllMeetings({ limit: 50 });
      const meetingList = res?.data?.meetings || res?.data || [];
      setMeetings(Array.isArray(meetingList) ? meetingList : []);
      if (meetingList.length > 0) {
        setSelectedMeetingId(meetingList[0]._id);
      }
    } catch {
      toast.error("Failed to load meetings");
    } finally {
      setLoadingMeetings(false);
    }
  };

  const handleApplyToMeeting = async (e) => {
    e.preventDefault();
    if (!selectedMeetingId) {
      toast.error("Please select a meeting");
      return;
    }
    setSubmittingApply(true);
    try {
      await applyPlaybookToMeeting(applyingPlaybook._id, selectedMeetingId);
      toast.success(
        `Applied "${applyingPlaybook.name}" to meeting successfully!`,
      );
      setApplyingPlaybook(null);
    } catch {
      toast.error("Failed to apply playbook to meeting");
    } finally {
      setSubmittingApply(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Meeting Playbooks
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Design, version, and apply step-by-step facilitation playbooks to
            meetings.
          </p>
        </div>
      </div>

      {/* AI Generator */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Bot className="text-blue-500" size={20} />
          AI Generate Playbook
        </h3>
        <form onSubmit={handleGenerateAI} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Meeting Type (e.g. Sprint Retrospective, Post-Mortem, Strategy
              Kickoff)
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              placeholder="Enter meeting type"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Prompt / Goals
            </label>
            <textarea
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              rows="3"
              placeholder="Describe the meeting goals or desired step breakdown..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition"
          >
            <Bot size={18} />
            {generating ? "Generating..." : "Generate Playbook"}
          </button>
        </form>
      </div>

      {/* Available Playbooks */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Playbook Library
        </h3>
        {loading ? (
          <div className="text-gray-500 py-8 text-center">
            Loading playbooks...
          </div>
        ) : playbooks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No playbooks created yet. Generate one with AI above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playbooks.map((playbook) => (
              <div
                key={playbook._id}
                className="border dark:border-gray-700 rounded-xl p-5 bg-gray-50/50 dark:bg-gray-900/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div className="pr-4">
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                        {playbook.name}
                      </h4>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 mt-1 font-medium">
                        <Layers size={12} /> v{playbook.version || 1}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(playbook._id)}
                      className="text-red-400 hover:text-red-600 p-1 transition"
                      title="Delete playbook"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mt-3 text-sm line-clamp-2">
                    {playbook.description || "No description provided."}
                  </p>
                  <div className="mt-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Steps: {playbook.steps?.length || 0} • Est. Duration:{" "}
                    {(playbook.steps || []).reduce(
                      (acc, s) => acc + (s.durationMinutes || 0),
                      0,
                    )}{" "}
                    mins
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEditor(playbook)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition"
                  >
                    <Edit2 size={14} /> Edit Steps
                  </button>
                  <button
                    onClick={() => handleOpenVersionHistory(playbook)}
                    className="inline-flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition"
                    title="Version history"
                  >
                    <History size={14} />
                  </button>
                  <button
                    onClick={() => handleOpenApplyModal(playbook)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition"
                  >
                    <CalendarCheck size={14} /> Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step Editor Modal */}
      {editingPlaybook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit2 size={20} className="text-indigo-500" />
                Edit Playbook & Steps
              </h3>
              <button
                onClick={() => setEditingPlaybook(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePlaybookEdits} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Playbook Name
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    value={editingPlaybook.name}
                    onChange={(e) =>
                      setEditingPlaybook({
                        ...editingPlaybook,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    value={editingPlaybook.description}
                    onChange={(e) =>
                      setEditingPlaybook({
                        ...editingPlaybook,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Steps List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Playbook Steps ({editingPlaybook.steps.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md font-semibold hover:bg-blue-100 transition"
                  >
                    <Plus size={14} /> Add Step
                  </button>
                </div>

                {editingPlaybook.steps.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/30 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">
                        Step {sIdx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveStep(sIdx, -1)}
                          disabled={sIdx === 0}
                          className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                          title="Move step up"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(sIdx, 1)}
                          disabled={sIdx === editingPlaybook.steps.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                          title="Move step down"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(sIdx)}
                          className="p-1 text-red-500 hover:text-red-700 ml-2"
                          title="Remove step"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                          Step Title
                        </label>
                        <input
                          type="text"
                          className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                          value={step.title}
                          onChange={(e) =>
                            handleStepChange(sIdx, "title", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                          Duration (Mins)
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                          value={step.durationMinutes}
                          onChange={(e) =>
                            handleStepChange(
                              sIdx,
                              "durationMinutes",
                              Number(e.target.value),
                            )
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Facilitator Prompts */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                          Facilitator Prompts / Guidance
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddPrompt(sIdx)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          + Add Prompt
                        </button>
                      </div>
                      {(step.facilitatorPrompts || []).map(
                        (promptStr, pIdx) => (
                          <div key={pIdx} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              className="flex-1 p-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                              value={promptStr}
                              onChange={(e) =>
                                handlePromptChange(sIdx, pIdx, e.target.value)
                              }
                              placeholder="e.g. Ask team what went well this sprint..."
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePrompt(sIdx, pIdx)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditingPlaybook(null)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold shadow"
                >
                  <Save size={16} />
                  {savingEdit ? "Saving Version..." : "Save New Version"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {versionHistoryPlaybook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <History size={20} className="text-indigo-500" />
                  Version History: {versionHistoryPlaybook.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Current active version: v{versionHistoryPlaybook.version || 1}
                </p>
              </div>
              <button
                onClick={() => setVersionHistoryPlaybook(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            {!versionHistoryPlaybook.versions ||
            versionHistoryPlaybook.versions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No prior version snapshots recorded for this playbook yet.
              </div>
            ) : (
              <div className="space-y-3">
                {versionHistoryPlaybook.versions.map((ver) => (
                  <div
                    key={ver._id || ver.version}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between bg-gray-50 dark:bg-gray-900/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 dark:text-white">
                          v{ver.version} — {ver.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(ver.savedAt).toLocaleDateString()}{" "}
                          {new Date(ver.savedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Steps: {ver.steps?.length || 0}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        handleRestoreVersion(
                          versionHistoryPlaybook._id,
                          ver.version,
                        )
                      }
                      disabled={restoringVersion}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 hover:bg-indigo-100 rounded-md text-xs font-semibold transition"
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apply Playbook to Meeting Modal */}
      {applyingPlaybook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarCheck size={18} className="text-indigo-500" />
                Apply Playbook to Meeting
              </h3>
              <button
                onClick={() => setApplyingPlaybook(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Assign <strong>"{applyingPlaybook.name}"</strong> to a meeting to
              enable guided live facilitation steps in the meeting room.
            </p>

            <form onSubmit={handleApplyToMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Select Meeting
                </label>
                {loadingMeetings ? (
                  <div className="text-xs text-gray-400 py-2">
                    Loading meetings...
                  </div>
                ) : (
                  <select
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    value={selectedMeetingId}
                    onChange={(e) => setSelectedMeetingId(e.target.value)}
                    required
                  >
                    {meetings.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.title} ({new Date(m.date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setApplyingPlaybook(null)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApply || !selectedMeetingId}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50"
                >
                  {submittingApply ? "Applying..." : "Confirm & Apply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingPlaybooks;
