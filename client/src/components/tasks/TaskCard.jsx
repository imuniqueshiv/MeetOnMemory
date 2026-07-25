import React from "react";
import {
  Calendar,
  User,
  Building2,
  FileText,
  ExternalLink,
} from "lucide-react";
import { STATUS_STYLES, PRIORITY_STYLES } from "../../utils/taskStyles";

export default function TaskCard({ task, setSelectedTask, navigate }) {
  const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES["open"];
  const priorityStyle =
    PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const StatusIcon = statusStyle.icon;

  return (
    <div
      onClick={() => setSelectedTask(task)}
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-2">
              {task.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priorityStyle.bgColor} ${priorityStyle.textColor} ${priorityStyle.borderColor} shrink-0`}
            >
              {priorityStyle.label}
            </span>
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
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${statusStyle.bgColor} ${statusStyle.textColor} ${statusStyle.borderColor}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {statusStyle.label}
            </span>

            {/* Due Date */}
            {task.dueDate && (
              <span className="flex items-center gap-1.5">
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

        {/* Meeting Link */}
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
  );
}
