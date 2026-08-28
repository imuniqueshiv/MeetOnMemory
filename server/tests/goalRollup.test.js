import { computeGoalRollup } from "../utils/goalRollup.js";

describe("computeGoalRollup (Issue #2466)", () => {
  it("returns zeroed metrics for no entries", () => {
    const r = computeGoalRollup([]);
    expect(r.totalGoals).toBe(0);
    expect(r.completionRate).toBe(0);
    expect(r.meetingsWithGoals).toBe(0);
    expect(r.byStatus).toEqual({
      pending: 0,
      achieved: 0,
      partially_achieved: 0,
      not_achieved: 0,
    });
    expect(r.perOccurrence).toEqual([]);
  });

  it("counts statuses and weights completion (achieved=1, partial=0.5, else 0)", () => {
    const r = computeGoalRollup([
      {
        meetingId: "m1",
        seriesOccurrence: 1,
        goals: [
          { status: "achieved" },
          { status: "partially_achieved" },
          { status: "pending" },
          { status: "not_achieved" },
        ],
      },
    ]);
    expect(r.totalGoals).toBe(4);
    expect(r.byStatus).toEqual({
      pending: 1,
      achieved: 1,
      partially_achieved: 1,
      not_achieved: 1,
    });
    expect(r.achievedCount).toBe(1);
    // (1 + 0.5 + 0 + 0) / 4 = 0.375
    expect(r.completionRate).toBe(0.375);
    expect(r.meetingsWithGoals).toBe(1);
  });

  it("aggregates across a series and reports per-occurrence, sorted", () => {
    const r = computeGoalRollup([
      {
        meetingId: "m2",
        seriesOccurrence: 2,
        goals: [{ status: "achieved" }, { status: "achieved" }],
      },
      {
        meetingId: "m1",
        seriesOccurrence: 1,
        goals: [{ status: "pending" }, { status: "achieved" }],
      },
    ]);
    expect(r.totalGoals).toBe(4);
    // 3 achieved + 1 pending → 3/4 = 0.75
    expect(r.completionRate).toBe(0.75);
    expect(r.perOccurrence.map((o) => o.occurrence)).toEqual([1, 2]);
    expect(r.perOccurrence[0].completionRate).toBe(0.5); // occ 1: 1 of 2
    expect(r.perOccurrence[1].completionRate).toBe(1); // occ 2: 2 of 2
  });

  it("treats unknown/missing statuses as pending and ignores non-goal entries", () => {
    const r = computeGoalRollup([
      {
        meetingId: "m1",
        seriesOccurrence: 1,
        goals: [{ status: "banana" }, {}],
      },
      { meetingId: "m2", seriesOccurrence: 2, goals: [] }, // no goals → not counted in meetingsWithGoals
    ]);
    expect(r.totalGoals).toBe(2);
    expect(r.byStatus.pending).toBe(2);
    expect(r.completionRate).toBe(0);
    expect(r.meetingsWithGoals).toBe(1);
  });

  it("is defensive against non-array input", () => {
    expect(computeGoalRollup(null).totalGoals).toBe(0);
    expect(computeGoalRollup(undefined).perOccurrence).toEqual([]);
  });
});
