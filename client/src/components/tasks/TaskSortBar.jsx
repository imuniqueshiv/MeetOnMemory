import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export default function TaskSortBar({ sortBy, sortOrder, handleSort }) {
  return (
    <div className="mb-6 flex items-center gap-4 text-sm fade-in-up stagger-2">
      <span className="text-slate-500 dark:text-slate-400">Sort by:</span>
      <div className="flex flex-wrap gap-2">
        {[
          { field: "dueDate", label: "Due Date" },
          { field: "createdDate", label: "Recently Created" },
          { field: "priority", label: "Priority" },
          { field: "importance", label: "Importance" },
          { field: "status", label: "Status" },
          { field: "alphabetical", label: "A-Z" },
        ].map((sort) => (
          <button
            key={sort.field}
            onClick={() => handleSort(sort.field)}
            className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              sortBy === sort.field
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {sort.label}
            {sortBy === sort.field &&
              (sortOrder === "asc" ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              ))}
          </button>
        ))}
      </div>
    </div>
  );
}
