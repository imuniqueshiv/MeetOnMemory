/**
 * Meeting contribution equity (Issue #2449).
 *
 * Pure metrics over per-participant contribution scores, so a facilitator can
 * see how *evenly* participation is spread (not just who's on top). Equity is
 * derived from the Gini coefficient of the participants' impact scores —
 * overall and per dimension — plus each participant's share for charting. No IO.
 */

const DIMENSIONS = ["verbal", "decisional", "task", "collaborative"];

/**
 * Gini coefficient of a set of non-negative values: 0 = perfectly equal,
 * approaching 1 = maximally unequal. An empty set or all-zero set is treated as
 * perfectly equal (0).
 */
export function giniCoefficient(values) {
  const nums = (Array.isArray(values) ? values : [])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v >= 0);
  const n = nums.length;
  if (n === 0) return 0;
  const total = nums.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let absDiff = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      absDiff += Math.abs(nums[i] - nums[j]);
    }
  }
  // absDiff / (2 * n^2 * mean), where mean = total / n → absDiff / (2 * n * total).
  return absDiff / (2 * n * total);
}

/** Convert a Gini coefficient into a 0–100 equity score (100 = perfectly equal). */
export const equityFromGini = (gini) => Math.round((1 - gini) * 100);

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * @param {Array<{ participantId?: string, participantName?: string, overallImpact?: number,
 *                 dimensions?: { verbal?: number, decisional?: number, task?: number, collaborative?: number } }>} contributions
 */
export function computeEquityBreakdown(contributions) {
  const list = Array.isArray(contributions) ? contributions : [];
  const overallValues = list.map((c) => Number(c?.overallImpact ?? 0));

  const perDimension = {};
  for (const dim of DIMENSIONS) {
    perDimension[dim] = equityFromGini(
      giniCoefficient(list.map((c) => Number(c?.dimensions?.[dim] ?? 0))),
    );
  }

  const totalImpact = overallValues.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const distribution = list
    .map((c) => {
      const score = Number(c?.overallImpact ?? 0);
      return {
        participantId: c?.participantId ?? null,
        participantName: c?.participantName ?? "Unknown",
        score,
        share:
          totalImpact > 0 ? Math.round((score / totalImpact) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  const gini = giniCoefficient(overallValues);
  return {
    overall: equityFromGini(gini),
    gini: round3(gini),
    participantCount: list.length,
    perDimension,
    distribution,
  };
}
