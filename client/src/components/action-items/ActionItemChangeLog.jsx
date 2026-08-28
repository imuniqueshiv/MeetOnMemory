import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  useActionItemChangeLogs,
  useActionItemChangeLogStats,
} from "../../hooks/useActionItemChangeLog";

const ActionItemChangeLog = ({ actionItemId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState("");

  const { data: logsData, isLoading: isLogsLoading } = useActionItemChangeLogs(
    actionItemId,
    {
      type: filterType || undefined,
      limit: 50,
    },
  );

  const { data: statsData, isLoading: isStatsLoading } =
    useActionItemChangeLogStats(actionItemId);

  const logs = logsData?.data || [];
  const stats = statsData?.data || null;

  const renderDiff = (log) => {
    let { changeType, oldValue, newValue } = log;

    if (changeType === "dueDate") {
      oldValue = oldValue ? format(parseISO(oldValue), "MMM d, yyyy") : "None";
      newValue = newValue ? format(parseISO(newValue), "MMM d, yyyy") : "None";
    }

    return (
      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-red-500 line-through mr-2">
            {String(oldValue || "None")}
          </span>
          <span className="text-gray-400 mx-2 hidden sm:inline">➔</span>
          <span className="font-semibold text-green-500">
            {String(newValue || "None")}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm transition-all duration-300">
      {/* Header / Summary Stats */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <svg
            className="w-5 h-5 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="font-semibold text-gray-800 dark:text-white">
            Audit History
          </h3>

          {!isStatsLoading && stats && (
            <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 ml-4">
              <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                {stats.totalChanges} changes
              </span>
              <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-full font-medium">
                {stats.uniqueEditorsCount} editors
              </span>
              {stats.reassignments > 0 && (
                <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-1 rounded-full font-medium">
                  {stats.reassignments} handoffs
                </span>
              )}
            </div>
          )}
        </div>

        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? "transform rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Timeline
            </h4>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white py-1.5 pl-3 pr-8"
            >
              <option value="">All Changes</option>
              <option value="status">Status</option>
              <option value="assignee">Assignee</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="description">Description</option>
            </select>
          </div>

          {isLogsLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No history available.
            </div>
          ) : (
            <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3 space-y-8 pb-4">
              {logs.map((log) => (
                <div key={log._id} className="relative pl-6">
                  {/* Timeline dot */}
                  <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-gray-900 shadow-sm" />

                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {log.changedBy?.name?.charAt(0) || "U"}
                      </div>
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {log.changedBy?.name || "Unknown User"}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        changed{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-300 capitalize">
                          {log.changeType}
                        </span>
                      </span>
                    </div>
                    <time className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {format(new Date(log.createdAt), "MMM d, h:mm a")}
                    </time>
                  </div>

                  {renderDiff(log)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionItemChangeLog;
