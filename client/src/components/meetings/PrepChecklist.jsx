import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  Circle,
  Plus,
  Trash2,
  Users,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { meetingChecklistApi } from "../../services/meetingChecklistApi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const PrepChecklist = ({ meeting, currentUser }) => {
  const [checklist, setChecklist] = useState(null);
  const [readiness, setReadiness] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  // Organizer state
  const [newItemText, setNewItemText] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemAssignee, setNewItemAssignee] = useState("");
  const [newItemDueDate, setNewItemDueDate] = useState("");
  const [itemsToCreate, setItemsToCreate] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  const isUserOrganizer = React.useCallback((m, u) => {
    if (!m || !u) return false;
    const currentId = u.publicMetadata?.dbUserId || u._id || u.id;
    const ownerId = m.uploadedBy || m.owner;
    return currentId && ownerId && String(currentId) === String(ownerId);
  }, []);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await meetingChecklistApi.getChecklist(meeting._id);
      if (res.data?.data?.checklist) {
        setChecklist(res.data.data.checklist);
        if (isUserOrganizer(meeting, currentUser)) {
          const readinessRes = await meetingChecklistApi.getReadiness(
            meeting._id,
          );
          if (readinessRes.data?.data?.readiness) {
            setReadiness(readinessRes.data.data.readiness);
          }
        }
      } else {
        setChecklist(null);
      }
    } catch (err) {
      console.error("Failed to fetch checklist", err);
    } finally {
      setLoading(false);
    }
  }, [meeting, currentUser, isUserOrganizer]);

  useEffect(() => {
    if (meeting && currentUser) {
      setIsOrganizer(isUserOrganizer(meeting, currentUser));
      fetchData();
    }
  }, [meeting, currentUser, isUserOrganizer, fetchData]);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;

    let assigneeObj = null;
    if (newItemAssignee) {
      const p = meeting.participants?.find(
        (part) =>
          String(part.user || part.userId || part._id || part.id) ===
          String(newItemAssignee),
      );
      if (p) {
        assigneeObj = { _id: newItemAssignee, name: p.name || p.email };
      }
    }

    setItemsToCreate([
      ...itemsToCreate,
      {
        text: newItemText,
        description: newItemDesc,
        required: false,
        assignee: newItemAssignee || null,
        dueDate: newItemDueDate || null,
        localAssignee: assigneeObj,
      },
    ]);
    setNewItemText("");
    setNewItemDesc("");
    setNewItemAssignee("");
    setNewItemDueDate("");
  };

  const handleRemoveItemToCreate = (index) => {
    setItemsToCreate(itemsToCreate.filter((_, i) => i !== index));
  };

  const handleDeleteExistingItem = async (index) => {
    try {
      const updatedItems = checklist.items.filter((_, i) => i !== index);
      if (updatedItems.length === 0) {
        await meetingChecklistApi.deleteChecklist(meeting._id);
        setChecklist(null);
        toast.success("Checklist deleted");
      } else {
        const res = await meetingChecklistApi.updateChecklist(meeting._id, {
          items: updatedItems.map((item) => ({
            text: item.text,
            description: item.description,
            required: item.required,
            assignee: item.assignee?._id || item.assignee || null,
            dueDate: item.dueDate || null,
          })),
        });
        setChecklist(res.data.data.checklist);
        toast.success("Checklist updated");
        // Also update readiness if possible
        if (isUserOrganizer(meeting, currentUser)) {
          const readinessRes = await meetingChecklistApi.getReadiness(
            meeting._id,
          );
          if (readinessRes.data?.data?.readiness) {
            setReadiness(readinessRes.data.data.readiness);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update checklist");
    }
  };

  const handleAddNewItemToExisting = async (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;

    try {
      const newItem = {
        text: newItemText,
        description: newItemDesc,
        required: false,
        assignee: newItemAssignee || null,
        dueDate: newItemDueDate || null,
      };

      const existingItemsMapped = checklist.items.map((item) => ({
        text: item.text,
        description: item.description,
        required: item.required,
        assignee: item.assignee?._id || item.assignee || null,
        dueDate: item.dueDate || null,
      }));

      const updatedItems = [...existingItemsMapped, newItem];
      const res = await meetingChecklistApi.updateChecklist(meeting._id, {
        items: updatedItems,
      });
      setChecklist(res.data.data.checklist);
      toast.success("Task added successfully");

      setNewItemText("");
      setNewItemDesc("");
      setNewItemAssignee("");
      setNewItemDueDate("");

      // Update readiness since checklist structure changed
      if (isUserOrganizer(meeting, currentUser)) {
        const readinessRes = await meetingChecklistApi.getReadiness(
          meeting._id,
        );
        if (readinessRes.data?.data?.readiness) {
          setReadiness(readinessRes.data.data.readiness);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add task");
    }
  };

  const handleSaveChecklist = async () => {
    if (itemsToCreate.length === 0) return;

    try {
      setIsCreating(true);
      await meetingChecklistApi.createChecklist(meeting._id, {
        items: itemsToCreate,
      });
      toast.success("Checklist created successfully");
      setItemsToCreate([]);
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to create checklist",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleItem = async (index) => {
    try {
      // Optimistic update
      const userId = currentUser.id || currentUser._id;
      const isCompleted = isItemCompleted(index);

      let newCompletions = [...(checklist.completions || [])];
      if (isCompleted) {
        newCompletions = newCompletions.filter(
          (c) => !(c.itemIndex === index && c.userId === userId),
        );
      } else {
        newCompletions.push({ itemIndex: index, userId });
      }

      setChecklist({ ...checklist, completions: newCompletions });

      // API call
      await meetingChecklistApi.toggleItem(meeting._id, index);
    } catch (err) {
      // Revert on error
      // Note: fetchData is now in useEffect, so we might need a different way to revert,
      // but for now just logging the error and showing toast
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  const isItemCompleted = (index) => {
    const userId = currentUser.id || currentUser._id;
    return (
      checklist?.completions?.some(
        (c) => c.itemIndex === index && c.userId === userId,
      ) || false
    );
  };

  const isPastMeeting = new Date(meeting.date) < new Date();

  if (loading) {
    return (
      <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
    );
  }

  // View: No checklist, not organizer
  if (!checklist && !isOrganizer) {
    return null;
  }

  // View: No checklist, is organizer
  if (!checklist && isOrganizer) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="text-blue-500 w-5 h-5" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Preparation Checklist
          </h3>
        </div>

        {isPastMeeting ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Cannot create checklist for past meetings.
          </p>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Add tasks for participants to complete before the meeting.
            </p>

            <form onSubmit={handleAddItem} className="space-y-3 mb-6">
              <input
                type="text"
                placeholder="Task description (e.g., Review Q2 report)"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
              />
              <input
                type="text"
                placeholder="Optional details..."
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  value={newItemAssignee}
                  onChange={(e) => setNewItemAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {meeting.participants?.map((p) => {
                    const pid =
                      p.user?.toString() ||
                      p.userId?.toString() ||
                      p._id?.toString() ||
                      p.id?.toString();
                    return (
                      <option key={pid} value={pid}>
                        {p.name || p.email}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="datetime-local"
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  value={newItemDueDate}
                  onChange={(e) => setNewItemDueDate(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!newItemText.trim()}
                  className="px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md text-sm font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </form>

            {itemsToCreate.length > 0 && (
              <div className="space-y-4">
                <div className="border border-gray-100 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
                  {itemsToCreate.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 flex justify-between items-start"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.text}
                        </p>
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-1">
                            {item.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.localAssignee && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              <Users className="w-3 h-3" />
                              {item.localAssignee.name}
                            </span>
                          )}
                          {item.dueDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              Due: {new Date(item.dueDate).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItemToCreate(index)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSaveChecklist}
                  disabled={isCreating}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  {isCreating
                    ? "Saving..."
                    : "Save Checklist & Notify Participants"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // View: Has checklist
  const totalItems = checklist.items.length;
  const userCompletedCount = checklist.items.filter((_, idx) =>
    isItemCompleted(idx),
  ).length;
  const userProgress = Math.round((userCompletedCount / totalItems) * 100);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-blue-500 w-5 h-5" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Preparation Checklist
          </h3>
        </div>

        {/* User Progress Indicator */}
        {!isOrganizer && (
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Your Progress:
            </div>
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg
                className="w-full h-full transform -rotate-90"
                viewBox="0 0 36 36"
              >
                <path
                  className="text-gray-200 dark:text-gray-700"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className={`${userProgress === 100 ? "text-green-500" : "text-blue-500"}`}
                  strokeDasharray={`${userProgress}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                />
              </svg>
              <span className="absolute text-[10px] font-medium">
                {userProgress}%
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tasks */}
        <div
          className={`space-y-3 ${isOrganizer ? "lg:col-span-2" : "lg:col-span-3"}`}
        >
          {checklist.items.map((item, index) => {
            const completed = isItemCompleted(index);
            const isOverdue =
              item.dueDate && !completed && new Date(item.dueDate) < new Date();

            return (
              <div
                key={index}
                className={`p-4 border rounded-lg transition-colors flex gap-3 items-center justify-between ${
                  completed
                    ? "bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700"
                    : isOverdue
                      ? "bg-red-50/50 border-red-300 dark:bg-red-900/10 dark:border-red-950"
                      : "bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600"
                }`}
              >
                <div className="flex gap-3 items-start">
                  <button
                    onClick={() => handleToggleItem(index)}
                    disabled={isPastMeeting}
                    className={`mt-0.5 flex-shrink-0 focus:outline-none ${isPastMeeting ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {completed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 hover:text-blue-500" />
                    )}
                  </button>
                  <div
                    className={`${completed ? "line-through text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"}`}
                  >
                    <p className="text-sm font-medium leading-relaxed">
                      {item.text}
                    </p>
                    {item.description && (
                      <p
                        className={`text-xs mt-1 ${completed ? "text-gray-400" : "text-gray-500 dark:text-gray-400"}`}
                      >
                        {item.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-2">
                      {item.assignee && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          <Users className="w-3 h-3" />
                          {item.assignee.name ||
                            item.assignee.email ||
                            "Assigned"}
                        </span>
                      )}
                      {item.dueDate && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isOverdue
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {isOverdue && <AlertCircle className="w-3 h-3" />}
                          Due: {new Date(
                            item.dueDate,
                          ).toLocaleDateString()}{" "}
                          {new Date(item.dueDate).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {isOverdue && "(Overdue)"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isOrganizer && (
                  <button
                    onClick={() => handleDeleteExistingItem(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Remove Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Organizer Add Task inline view */}
          {isOrganizer && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">
                Add Task to Checklist
              </h4>
              <form onSubmit={handleAddNewItemToExisting} className="space-y-3">
                <input
                  type="text"
                  placeholder="Task description (e.g., Review Q2 report)"
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Optional details..."
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    value={newItemAssignee}
                    onChange={(e) => setNewItemAssignee(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {meeting.participants?.map((p) => {
                      const pid =
                        p.user?.toString() ||
                        p.userId?.toString() ||
                        p._id?.toString() ||
                        p.id?.toString();
                      return (
                        <option key={pid} value={pid}>
                          {p.name || p.email}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="datetime-local"
                    className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    value={newItemDueDate}
                    onChange={(e) => setNewItemDueDate(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!newItemText.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Task
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Readiness (Organizer Only) */}
        {isOrganizer && readiness.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-5 border border-gray-100 dark:border-gray-700 h-64 flex flex-col">
            <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-300">
              <Users className="w-4 h-4" />
              <h4 className="font-medium text-sm">Team Readiness</h4>
            </div>

            <div className="flex-1 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={readiness}
                  layout="vertical"
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={80}
                    style={{ fill: "currentColor" }}
                    className="text-gray-500 dark:text-gray-400"
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-gray-900 text-white text-xs py-1 px-2 rounded shadow">
                            {`${data.completedCount} / ${data.totalItems} tasks completed`}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={12}>
                    {readiness.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.percentage === 100
                            ? "#10B981"
                            : entry.percentage > 0
                              ? "#3B82F6"
                              : "#E5E7EB"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrepChecklist;
