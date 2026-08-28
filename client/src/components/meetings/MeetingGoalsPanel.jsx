import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { Plus, Trash2, CheckCircle, Circle, ArrowRight } from "lucide-react";
import { meetingGoalApi } from "../../services";
import SeriesGoalRollup from "./SeriesGoalRollup";

const MeetingGoalsPanel = ({ meeting, currentUser }) => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // For pre-meeting form
  const [formData, setFormData] = useState([]);

  // Check if meeting is in the future
  const isPreMeeting = new Date(meeting.date) > new Date();

  // Only the owner can set goals
  const isOwner =
    meeting.uploadedBy === currentUser?.id ||
    meeting.uploadedBy?._id === currentUser?.id;

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await meetingGoalApi.getGoals(meeting._id);
      if (data.success && data.meetingGoal) {
        setGoals(data.meetingGoal.goals || []);
        if (isPreMeeting) {
          setFormData(data.meetingGoal.goals || []);
        }
      } else {
        setGoals([]);
        if (isPreMeeting) {
          setFormData([{ text: "", description: "" }]);
        }
      }
    } catch (error) {
      console.error("Error fetching goals:", error);
      toast.error("Failed to load meeting goals");
    } finally {
      setLoading(false);
    }
  }, [meeting._id, isPreMeeting]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleAddFormRow = () => {
    if (formData.length >= 5) {
      toast.warning("Maximum of 5 goals allowed");
      return;
    }
    setFormData([...formData, { text: "", description: "" }]);
  };

  const handleRemoveFormRow = (index) => {
    const newForm = [...formData];
    newForm.splice(index, 1);
    setFormData(newForm);
  };

  const handleFormChange = (index, field, value) => {
    const newForm = [...formData];
    newForm[index][field] = value;
    setFormData(newForm);
  };

  const handleSaveGoals = async () => {
    try {
      setSaving(true);
      const validGoals = formData.filter((g) => g.text.trim());

      if (validGoals.length === 0 && goals.length === 0) {
        toast.info("No goals to save.");
        setSaving(false);
        return;
      }

      if (validGoals.length > 5) {
        toast.error("Maximum of 5 goals allowed");
        setSaving(false);
        return;
      }

      const { data } = await meetingGoalApi.setGoals(meeting._id, {
        goals: validGoals,
      });
      if (data.success) {
        toast.success("Meeting goals saved successfully");
        setGoals(data.meetingGoal.goals);
        setFormData(data.meetingGoal.goals);
      }
    } catch (error) {
      console.error("Error saving goals:", error);
      toast.error(error.response?.data?.message || "Failed to save goals");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (goalId, newStatus) => {
    try {
      const { data } = await meetingGoalApi.updateGoalStatus(
        meeting._id,
        goalId,
        { status: newStatus },
      );
      if (data.success) {
        setGoals(data.meetingGoal.goals);
        toast.success("Goal status updated");
      }
    } catch (error) {
      console.error("Error updating goal:", error);
      toast.error(error.response?.data?.message || "Failed to update goal");
    }
  };

  const handleOutcomeNoteBlur = async (goalId, currentStatus, newNote) => {
    try {
      await meetingGoalApi.updateGoalStatus(meeting._id, goalId, {
        status: currentStatus,
        outcomeNote: newNote,
      });
    } catch (error) {
      console.error("Error saving outcome note:", error);
      toast.error("Failed to save outcome note");
    }
  };

  // Calculate achievements
  const achievedCount = goals.filter((g) => g.status === "achieved").length;
  const partialCount = goals.filter(
    (g) => g.status === "partially_achieved",
  ).length;
  const totalScore = achievedCount + partialCount * 0.5;
  const totalGoals = goals.length;
  const achievementPercentage =
    totalGoals > 0 ? Math.round((totalScore / totalGoals) * 100) : 0;

  if (loading) {
    return (
      <div className="animate-pulse bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 w-1/4 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 w-full rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 w-full rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <TargetIcon className="w-5 h-5 text-blue-500" />
          Meeting Goals
        </h2>

        {!isPreMeeting && totalGoals > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Achievement Score:
            </span>
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-gray-100 dark:border-gray-700 relative">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="42%"
                  fill="transparent"
                  stroke={
                    achievementPercentage >= 80
                      ? "#10B981"
                      : achievementPercentage >= 50
                        ? "#F59E0B"
                        : "#EF4444"
                  }
                  strokeWidth="4"
                  strokeDasharray={`${(achievementPercentage / 100) * 100} 100`}
                />
              </svg>
              <span className="text-sm font-bold text-gray-900 dark:text-white relative z-10">
                {achievementPercentage}%
              </span>
            </div>
          </div>
        )}
      </div>

      {isPreMeeting ? (
        // Pre-meeting mode: Edit Goals
        <div>
          {!isOwner && (
            <div className="mb-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded">
              Only the meeting organizer can set goals before the meeting.
            </div>
          )}

          <div className="space-y-4">
            {formData.map((goal, index) => (
              <div
                key={index}
                className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700"
              >
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    placeholder="Goal Title (e.g., Finalize Q3 Budget)"
                    value={goal.text}
                    onChange={(e) =>
                      handleFormChange(index, "text", e.target.value)
                    }
                    disabled={!isOwner}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
                  />
                  <input
                    type="text"
                    placeholder="Optional description"
                    value={goal.description || ""}
                    onChange={(e) =>
                      handleFormChange(index, "description", e.target.value)
                    }
                    disabled={!isOwner}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
                  />
                </div>
                {isOwner && (
                  <button
                    onClick={() => handleRemoveFormRow(index)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title="Remove goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleAddFormRow}
                disabled={formData.length >= 5}
                className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add Goal
              </button>
              <button
                onClick={handleSaveGoals}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Goals"}
              </button>
            </div>
          )}
        </div>
      ) : (
        // Post-meeting mode: Evaluate Goals
        <div>
          {goals.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              No goals were set for this meeting.
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <div
                  key={goal._id}
                  className={`p-4 rounded-lg border-l-4 border-y border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors
                    ${
                      goal.status === "achieved"
                        ? "border-l-green-500"
                        : goal.status === "partially_achieved"
                          ? "border-l-yellow-500"
                          : goal.status === "not_achieved"
                            ? "border-l-red-500"
                            : "border-l-gray-300"
                    }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                        {goal.text}
                      </h3>
                      {goal.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {goal.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 w-full md:w-48">
                      <select
                        value={goal.status}
                        onChange={(e) =>
                          handleStatusUpdate(goal._id, e.target.value)
                        }
                        className={`w-full text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 pl-3 pr-8 
                          ${
                            goal.status === "achieved"
                              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                              : goal.status === "partially_achieved"
                                ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                                : goal.status === "not_achieved"
                                  ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="achieved">Achieved</option>
                        <option value="partially_achieved">
                          Partially Achieved
                        </option>
                        <option value="not_achieved">Not Achieved</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <textarea
                      placeholder="Outcome note (optional)..."
                      defaultValue={goal.outcomeNote || ""}
                      onBlur={(e) => {
                        if (e.target.value !== goal.outcomeNote) {
                          handleOutcomeNoteBlur(
                            goal._id,
                            goal.status,
                            e.target.value,
                          );
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900/50 border border-transparent rounded-md focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-0 resize-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                      rows="1"
                      onInput={(e) => {
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                    />
                  </div>

                  {goal.resolvedBy && goal.resolvedAt && (
                    <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      Last updated {new Date(goal.resolvedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SeriesGoalRollup meetingId={meeting?._id} />
    </div>
  );
};

// TargetIcon component wrapper
const TargetIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

export default MeetingGoalsPanel;
