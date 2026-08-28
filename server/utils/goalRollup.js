/**
 * Meeting-goal outcome rollup (Issue #2466).
 *
 * Pure aggregation over the goal outcomes of a set of meetings (e.g. every
 * occurrence in a series). Turns raw goal statuses into completion metrics —
 * overall and per occurrence — so a series view can show whether goals are
 * actually being met across recurring meetings. No DB or IO; unit-tested.
 */

export const GOAL_STATUSES = [
  "pending",
  "achieved",
  "partially_achieved",
  "not_achieved",
];

// A partially-achieved goal counts as half toward completion.
const STATUS_WEIGHT = {
  achieved: 1,
  partially_achieved: 0.5,
  pending: 0,
  not_achieved: 0,
};

const emptyByStatus = () => ({
  pending: 0,
  achieved: 0,
  partially_achieved: 0,
  not_achieved: 0,
});

const round4 = (n) => Math.round(n * 10000) / 10000;

/**
 * @param {Array<{ meetingId?: any, seriesOccurrence?: number|null, goals?: Array<{ status?: string }> }>} entries
 * @returns rollup metrics: totals, byStatus counts, weighted completionRate (0–1),
 *          and a per-occurrence breakdown sorted by occurrence.
 */
export function computeGoalRollup(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const byStatus = emptyByStatus();
  let totalGoals = 0;
  let weighted = 0;
  let meetingsWithGoals = 0;
  const perOccurrence = [];

  for (const entry of list) {
    const goals = Array.isArray(entry?.goals) ? entry.goals : [];
    if (goals.length > 0) meetingsWithGoals += 1;

    const occByStatus = emptyByStatus();
    let occWeighted = 0;

    for (const goal of goals) {
      const status = GOAL_STATUSES.includes(goal?.status)
        ? goal.status
        : "pending";
      byStatus[status] += 1;
      occByStatus[status] += 1;
      totalGoals += 1;
      weighted += STATUS_WEIGHT[status];
      occWeighted += STATUS_WEIGHT[status];
    }

    perOccurrence.push({
      meetingId: entry?.meetingId ?? null,
      occurrence:
        typeof entry?.seriesOccurrence === "number"
          ? entry.seriesOccurrence
          : null,
      total: goals.length,
      byStatus: occByStatus,
      completionRate: goals.length ? round4(occWeighted / goals.length) : 0,
    });
  }

  perOccurrence.sort((a, b) => (a.occurrence ?? 0) - (b.occurrence ?? 0));

  return {
    totalGoals,
    meetingsWithGoals,
    byStatus,
    achievedCount: byStatus.achieved,
    completionRate: totalGoals ? round4(weighted / totalGoals) : 0,
    perOccurrence,
  };
}
