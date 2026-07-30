import React, { useState } from "react";
import {
  Calendar,
  User,
  Building2,
  FileText,
  ExternalLink,
  ChevronDown,
  Loader2,
  Bell,
  BellOff,
  AlertCircle,
  Clock,
} from "lucide-react";
import { STATUS_STYLES, PRIORITY_STYLES } from "../../utils/taskStyles";

export default function TaskCard({
  task,
  setSelectedTask,
  navigate,
  updateTaskStatus,
  toggleTaskReminder,
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTogglingReminder, setIsTogglingReminder] = useState(false);

  const handleStatusChange = async (e) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    if (updateTaskStatus && newStatus !== task.status) {
      setIsUpdating(true);
      await updateTaskStatus(task.id, newStatus);
      setIsUpdating(false);
    }
  };

  const handleReminderToggle = async (e) => {
    e.stopPropagation();
    if (toggleTaskReminder) {
      setIsTogglingReminder(true);
      await toggleTaskReminder(task.id, task.remindersEnabled !== false);
      setIsTogglingReminder(false);
    }
  };

  const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES["open"];
  const priorityStyle =
    PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const StatusIcon = statusStyle.icon;

  const now = new Date();
  const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue =
    dueDateObj &&
    dueDateObj < now &&
    (task.status === "open" || task.status === "in-progress");
  const isDueSoon =
    dueDateObj &&
    dueDateObj > now &&
    dueDateObj <= new Date(now.getTime() + 24 * 60 * 60 * 1000) &&
    (task.status === "open" || task.status === "in-progress");

  return (
    <div
      onClick={() => setSelectedTask(task)}
      className={`group bg-white dark:bg-slate-900 border rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer ${
        isOverdue
          ? "border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-2">
              {task.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priorityStyle.bgColor} ${priorityStyle.textColor} ${priorityStyle.borderColor} shrink-0`}
            >
              {priorityStyle.label}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 shrink-0">
                <AlertCircle className="w-3 h-3" /> Overdue
              </span>
            )}
            {isDueSoon && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                <Clock className="w-3 h-3" /> Due Soon
              </span>
            )}
            {typeof task.importanceScore === "number" && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 shrink-0"
                title="Memory importance score"
              >
                {task.importanceScore}/100
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
            {/* Status */}
            <div className="relative inline-flex items-center">
              {isUpdating ? (
                <Loader2
                  className={`absolute left-2 w-3.5 h-3.5 animate-spin ${statusStyle.textColor}`}
                />
              ) : (
                <StatusIcon
                  className={`absolute left-2 w-3.5 h-3.5 pointer-events-none ${statusStyle.textColor}`}
                />
              )}
              <select
                value={task.status}
                onClick={(e) => e.stopPropagation()}
                onChange={handleStatusChange}
                disabled={isUpdating}
                className={`appearance-none pl-7 pr-6 py-1 rounded-lg text-xs font-medium border cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${statusStyle.bgColor} ${statusStyle.textColor} ${statusStyle.borderColor}`}
              >
                {Object.entries(STATUS_STYLES).map(([statusKey, style]) => (
                  <option
                    key={statusKey}
                    value={statusKey}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {style.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={`absolute right-2 w-3 h-3 pointer-events-none opacity-70 ${statusStyle.textColor}`}
              />
            </div>

            {/* Due Date */}
            {task.dueDate && (
              <span
                className={`flex items-center gap-1.5 ${isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}

            {/* Assigned To */}
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {task.owner}
            </span>

            {/* Organization */}
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {task.organization}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReminderToggle}
            disabled={isTogglingReminder}
            title={
              task.remindersEnabled !== false
                ? "Reminders Enabled — click to disable"
                : "Reminders Disabled — click to enable"
            }
            className={`p-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              task.remindersEnabled !== false
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
          >
            {isTogglingReminder ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : task.remindersEnabled !== false ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/meeting/${task.meetingId}`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">View Meeting</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
