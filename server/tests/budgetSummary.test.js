import { computeBudgetSummary } from "../utils/budgetSummary.js";

const NOW = new Date("2025-06-10T12:00:00.000Z");

describe("computeBudgetSummary (Issue #2375)", () => {
  it("sums approved as spent, tracks pending, excludes rejected", () => {
    const summary = computeBudgetSummary(
      { totalBudget: 1000, currency: "USD" },
      [
        { amount: 200, category: "Catering", status: "approved" },
        { amount: 100, category: "Travel", status: "approved" },
        { amount: 50, category: "Travel", status: "pending" },
        { amount: 999, category: "Misc", status: "rejected" },
      ],
      { asOf: NOW },
    );

    expect(summary.totalSpent).toBe(300);
    expect(summary.remaining).toBe(700);
    expect(summary.pendingAmount).toBe(50);
    expect(summary.utilizationPct).toBe(30);
    expect(summary.overBudget).toBe(false);
    expect(summary.byCategory).toEqual({ Catering: 200, Travel: 100 });
    expect(summary.byStatus).toEqual({
      pending: 50,
      approved: 300,
      rejected: 999,
    });
  });

  it("flags over-budget when approved exceeds the total", () => {
    const summary = computeBudgetSummary(
      { totalBudget: 100 },
      [{ amount: 150, status: "approved" }],
      { asOf: NOW },
    );
    expect(summary.overBudget).toBe(true);
    expect(summary.remaining).toBe(-50);
    expect(summary.utilizationPct).toBe(150);
  });

  it("computes burn rate and forecast over the period", () => {
    const summary = computeBudgetSummary(
      {
        totalBudget: 1000,
        periodStart: new Date("2025-05-31T12:00:00.000Z"), // 10 days before NOW
        periodEnd: new Date("2025-06-30T12:00:00.000Z"), // 20 days after NOW
      },
      [{ amount: 300, status: "approved" }],
      { asOf: NOW },
    );

    expect(summary.daysElapsed).toBe(10);
    expect(summary.daysRemaining).toBe(20);
    expect(summary.dailyBurnRate).toBe(30);
    expect(summary.projectedTotal).toBe(900); // 300 + 30 * 20
  });

  it("is defensive: zero budget and non-array expenses do not throw", () => {
    const summary = computeBudgetSummary({ totalBudget: 0 }, null, {
      asOf: NOW,
    });
    expect(summary.utilizationPct).toBe(0);
    expect(summary.totalSpent).toBe(0);
    expect(summary.byCategory).toEqual({});
    expect(summary.byStatus).toEqual({ pending: 0, approved: 0, rejected: 0 });
  });
});
