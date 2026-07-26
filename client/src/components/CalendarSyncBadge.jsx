import React from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const CalendarSyncBadge = ({ externalCalendarRefs }) => {
  if (!externalCalendarRefs || externalCalendarRefs.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
        <XCircle className="w-3.5 h-3.5" />
        Not synced
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Synced ({externalCalendarRefs.length})
    </div>
  );
};

export default CalendarSyncBadge;
