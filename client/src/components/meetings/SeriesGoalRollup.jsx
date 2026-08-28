import React, { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { meetingGoalApi } from "../../services";

const asPercent = (rate) => `${Math.round((rate || 0) * 100)}%`;

/**
 * Issue #2466 — series goal rollup.
 * Loads and displays aggregated goal outcomes across every occurrence of this
 * meeting's series (overall completion + per-occurrence breakdown).
 */
const SeriesGoalRollup = ({ meetingId }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!meetingId) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await meetingGoalApi.getSeriesGoalRollup(meetingId);
      setData(res.data);
    } catch (e) {
      setError(
        e?.response?.data?.message || "Could not load the series rollup.",
      );
    } finally {
      setLoading(false);
    }
  };

  const rollup = data?.rollup;

  return (
    <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : load())}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200"
      >
        <span className="flex items-center gap-2">
          <BarChart3 size={14} /> Series goal rollup
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-700">
          {loading ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : rollup && rollup.totalGoals > 0 ? (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                  <span>
                    Overall completion across {data.meetingCount} meeting
                    {data.meetingCount === 1 ? "" : "s"}
                  </span>
                  <span className="font-semibold">
                    {asPercent(rollup.completionRate)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: asPercent(rollup.completionRate) }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {rollup.achievedCount} achieved ·{" "}
                  {rollup.byStatus.partially_achieved} partial ·{" "}
                  {rollup.byStatus.not_achieved} missed ·{" "}
                  {rollup.byStatus.pending} pending ({rollup.totalGoals} goals)
                </div>
              </div>

              <ul className="space-y-1">
                {rollup.perOccurrence.map((occ, i) => (
                  <li
                    key={occ.meetingId || i}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="w-16 shrink-0 text-gray-500">
                      {occ.occurrence != null
                        ? `#${occ.occurrence}`
                        : "Meeting"}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                      <span
                        className="block h-full bg-emerald-500"
                        style={{ width: asPercent(occ.completionRate) }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-gray-600 dark:text-gray-300">
                      {asPercent(occ.completionRate)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              No goals recorded for this series yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SeriesGoalRollup;
