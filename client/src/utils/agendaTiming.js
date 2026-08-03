// Timing maths shared by the live agenda timer so the pacing rules stay in one
// place and can be unit tested without rendering the socket-backed component.

// Amber warning starts once an item has used this share of its planned time.
export const WARNING_THRESHOLD = 0.8;

/**
 * Formats a duration in milliseconds as mm:ss (hours roll into minutes).
 */
export const formatClock = (ms) => {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Compares an agenda item's planned duration against the time it has actually
 * used. `liveElapsedMs` is the ticking value for the currently active item.
 *
 * @returns {{
 *   plannedMs: number,
 *   actualMs: number,
 *   hasPlan: boolean,
 *   isOverrun: boolean,
 *   isNearLimit: boolean,
 *   overrunMs: number,
 *   remainingMs: number,
 *   progressPercent: number,
 * }}
 */
export const getItemTiming = (item, liveElapsedMs = 0) => {
  const plannedMs = Math.max(0, (item?.duration || 0) * 60 * 1000);
  const actualMs =
    item?.status === "active"
      ? Math.max(0, liveElapsedMs)
      : Math.max(0, item?.actualDuration || 0);

  const hasPlan = plannedMs > 0;
  const isOverrun = hasPlan && actualMs > plannedMs;
  const ratio = hasPlan ? actualMs / plannedMs : 0;

  return {
    plannedMs,
    actualMs,
    hasPlan,
    isOverrun,
    isNearLimit: hasPlan && !isOverrun && ratio >= WARNING_THRESHOLD,
    overrunMs: isOverrun ? actualMs - plannedMs : 0,
    remainingMs: hasPlan ? Math.max(0, plannedMs - actualMs) : 0,
    progressPercent: hasPlan ? Math.min(100, Math.round(ratio * 100)) : 0,
  };
};

/**
 * Totals planned and actual time across every agenda item so the header can
 * show whether the meeting as a whole is running late.
 */
export const summarizeAgendaTiming = (items = [], liveElapsedMs = 0) => {
  const totals = items.reduce(
    (acc, item) => {
      const { plannedMs, actualMs } = getItemTiming(item, liveElapsedMs);
      acc.plannedMs += plannedMs;
      acc.actualMs += actualMs;
      return acc;
    },
    { plannedMs: 0, actualMs: 0 },
  );

  const itemsOverrun = items.filter(
    (item) => getItemTiming(item, liveElapsedMs).isOverrun,
  ).length;

  return {
    ...totals,
    itemsOverrun,
    isOverrun: totals.plannedMs > 0 && totals.actualMs > totals.plannedMs,
    overrunMs: Math.max(0, totals.actualMs - totals.plannedMs),
  };
};
