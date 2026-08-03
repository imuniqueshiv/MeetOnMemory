import { CalendarPlus, X } from "lucide-react";

/**
 * Sticky bulk action bar when action items are selected for a follow-up meeting.
 */
export default function FollowUpSelectionBar({
  selectedCount,
  onClear,
  onCreateFollowUp,
  canCreateMeeting,
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="sticky top-24 z-20 mb-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="text-sm text-blue-900 dark:text-blue-100">
        <span className="font-semibold">{selectedCount}</span> action item
        {selectedCount === 1 ? "" : "s"} selected for follow-up
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
        {canCreateMeeting && (
          <button
            type="button"
            onClick={onCreateFollowUp}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <CalendarPlus className="w-4 h-4" />
            Create Follow-up Meeting
          </button>
        )}
      </div>
    </div>
  );
}
