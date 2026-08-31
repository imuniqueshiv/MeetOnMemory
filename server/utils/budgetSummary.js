/**
 * Meeting budget utilization + burn-rate/forecast math (Issue #2375).
 *
 * Pure, IO-free: turn a budget envelope and its expense list into the numbers a
 * budget tracker needs — spent vs remaining, utilization %, per-category and
 * per-status rollups, a daily burn rate, and a projected end-of-period total.
 * Approved expenses count as spent; pending are tracked separately; rejected
 * are excluded. Unit-tested; the controller just supplies the persisted doc.
 */

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const round1 = (value) => Math.round(value * 10) / 10;

// Whole days between two dates, floored, minimum applied by the caller.
const daysBetween = (from, to) => {
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
};

/**
 * @param {{ totalBudget?: number, periodStart?: Date|string|null, periodEnd?: Date|string|null, currency?: string }} budget
 * @param {Array<{ amount?: number, category?: string, status?: string }>} expenses
 * @param {{ asOf?: Date }} [opts]
 * @returns {object} budget summary
 */
export function computeBudgetSummary(budget, expenses, opts = {}) {
  const safeBudget = budget ?? {};
  const list = Array.isArray(expenses) ? expenses : [];
  const asOf = opts.asOf instanceof Date ? opts.asOf : new Date();

  const totalBudget = num(safeBudget.totalBudget);
  const currency = safeBudget.currency || "USD";

  const byStatus = { pending: 0, approved: 0, rejected: 0 };
  const byCategory = {};
  let totalSpent = 0;
  let pendingAmount = 0;

  for (const expense of list) {
    const amount = num(expense?.amount);
    const status = expense?.status || "pending";
    if (status in byStatus) byStatus[status] += amount;

    if (status === "approved") {
      totalSpent += amount;
      const category = expense?.category || "Uncategorized";
      byCategory[category] = round1((byCategory[category] || 0) + amount);
    } else if (status === "pending") {
      pendingAmount += amount;
    }
  }

  const daysElapsed = Math.max(1, daysBetween(safeBudget.periodStart, asOf));
  const daysRemaining = Math.max(0, daysBetween(asOf, safeBudget.periodEnd));
  const dailyBurnRate = round1(totalSpent / daysElapsed);
  const projectedTotal = round1(totalSpent + dailyBurnRate * daysRemaining);

  return {
    currency,
    totalBudget: round1(totalBudget),
    totalSpent: round1(totalSpent),
    pendingAmount: round1(pendingAmount),
    remaining: round1(totalBudget - totalSpent),
    utilizationPct:
      totalBudget > 0 ? round1((totalSpent / totalBudget) * 100) : 0,
    overBudget: totalSpent > totalBudget,
    dailyBurnRate,
    projectedTotal,
    daysElapsed,
    daysRemaining,
    byCategory,
    byStatus: {
      pending: round1(byStatus.pending),
      approved: round1(byStatus.approved),
      rejected: round1(byStatus.rejected),
    },
  };
}
