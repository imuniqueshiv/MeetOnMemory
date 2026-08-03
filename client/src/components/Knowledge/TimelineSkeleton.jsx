// client/src/components/Knowledge/TimelineSkeleton.jsx

import React from "react";

/**
 * TimelineSkeleton Component
 * Provides a structured loading placeholder that matches the layout of the actual timeline items.
 * Prevents layout shift and improves perceived performance.
 */
const TimelineSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="relative pl-8 md:pl-12 pb-8 border-l-2 border-slate-200 dark:border-slate-800 last:border-0"
      >
        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800"></div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-md"></div>
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default TimelineSkeleton;
