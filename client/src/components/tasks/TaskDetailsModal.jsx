import React from "react";
import {
  X,
  Clock,
  User,
  Calendar,
  Building2,
  FileText,
  ExternalLink,
} from "lucide-react";
import { STATUS_STYLES, PRIORITY_STYLES } from "../../utils/taskStyles";

export default function TaskDetailsModal({
  selectedTask,
  setSelectedTask,
  navigate,
}) {
  if (!selectedTask) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setSelectedTask(null)}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Task Details
          </h2>
          <button
            onClick={() => setSelectedTask(null)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Task Title */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {selectedTask.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {selectedTask.description}
              </p>
            </div>

            {/* Status and Priority */}
            <div className="flex flex-wrap gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  STATUS_STYLES[selectedTask.status]?.bgColor || ""
                } ${STATUS_STYLES[selectedTask.status]?.textColor || ""} ${
                  STATUS_STYLES[selectedTask.status]?.borderColor || ""
                }`}
              >
                {React.createElement(
                  STATUS_STYLES[selectedTask.status]?.icon || Clock,
                  {
                    className: "w-4 h-4",
                  },
                )}
                {STATUS_STYLES[selectedTask.status]?.label ||
                  selectedTask.status}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  PRIORITY_STYLES[selectedTask.priority]?.bgColor || ""
                } ${PRIORITY_STYLES[selectedTask.priority]?.textColor || ""} ${
                  PRIORITY_STYLES[selectedTask.priority]?.borderColor || ""
                }`}
              >
                {PRIORITY_STYLES[selectedTask.priority]?.label ||
                  selectedTask.priority}{" "}
                Priority
              </span>
            </div>

            {/* Details */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                  <User className="w-4 h-4" />
                  Assigned To
                </div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {selectedTask.owner}
                </p>
              </div>

              {selectedTask.dueDate && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                    <Calendar className="w-4 h-4" />
                    Due Date
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {new Date(selectedTask.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                  <Building2 className="w-4 h-4" />
                  Organization
                </div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {selectedTask.organization}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                  <FileText className="w-4 h-4" />
                  Meeting Date
                </div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {new Date(selectedTask.meetingDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Related Meeting */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
                    <FileText className="w-4 h-4" />
                    Related Meeting
                  </div>
                  <p className="font-medium text-slate-900">
                    {selectedTask.meetingTitle}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    navigate(`/meeting/${selectedTask.meetingId}`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  View Meeting
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
