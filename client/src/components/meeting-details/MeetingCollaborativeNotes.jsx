import React, { useState } from "react";
import { FileText, ChevronDown, ChevronUp, Users } from "lucide-react";

const MeetingCollaborativeNotes = ({ meeting }) => {
  const [expanded, setExpanded] = useState(true);

  const notes = meeting?.collaborativeNotes;

  // Don't render the section at all if there are no collaborative notes
  if (!notes || notes.trim().length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Collaborative Notes
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Live notes captured during the meeting session
            </p>
          </div>
          {/* Badge */}
          <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-full">
            <Users size={11} />
            Collaborative
          </span>
        </div>
        <div className="text-gray-400 dark:text-gray-500 shrink-0 ml-4">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {/* Collapsible content */}
      {expanded && (
        <div className="px-6 pb-6">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Notes toolbar */}
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                Saved Notes
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {notes.trim().split(/\s+/).length} words · {notes.length} chars
              </span>
            </div>

            {/* Notes body — pre-formatted to preserve whitespace/newlines */}
            <pre className="p-5 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-white dark:bg-gray-800 max-h-96 overflow-y-auto">
              {notes}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingCollaborativeNotes;
