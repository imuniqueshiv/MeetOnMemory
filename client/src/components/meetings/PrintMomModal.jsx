import React, { useState } from "react";
import { Printer, Check, Eye, X, Settings2, FileText } from "lucide-react";

/**
 * PrintMomModal / PrintMinutesButton (Issue #2255)
 * Configurable print options (Include Decisions, Action Items, Attendees, Notes)
 * and trigger for window.print().
 */
const PrintMomModal = ({ isOpen, onClose, meeting, summary }) => {
  const [includeDecisions, setIncludeDecisions] = useState(true);
  const [includeActions, setIncludeActions] = useState(true);
  const [includeAttendees, setIncludeAttendees] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [compactLayout, setCompactLayout] = useState(false);

  if (!isOpen || !meeting) return null;

  const handlePrint = () => {
    window.print();
    onClose();
  };

  const title = meeting.title || summary?.title || "Meeting Minutes";
  const dateStr = meeting.date
    ? new Date(meeting.date).toLocaleDateString()
    : new Date().toLocaleDateString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm no-print animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Print Meeting Minutes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure sections before launching print / PDF layout.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4 text-sm">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1">
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs">
              {title}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Date: {dateStr} • ID:{" "}
              {(meeting._id || meeting.id || "").slice(-6)}
            </p>
          </div>

          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Included Minutes Sections
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeDecisions}
                onChange={(e) => setIncludeDecisions(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Include Decisions & Consensus Log</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeActions}
                onChange={(e) => setIncludeActions(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Include Action Items & Assigned Owners</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeAttendees}
                onChange={(e) => setIncludeAttendees(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Include Attendee Roll & Roles</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Include Key Discussion Notes</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input
                type="checkbox"
                checked={compactLayout}
                onChange={(e) => setCompactLayout(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Compact Single-Page Layout (reduced margins)</span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Open Print Dialog</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintMomModal;
