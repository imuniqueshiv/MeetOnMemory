import {
  giniCoefficient,
  equityFromGini,
  computeEquityBreakdown,
} from "../utils/contributionEquity.js";

describe("giniCoefficient (Issue #2449)", () => {
  it("is 0 for empty, single, all-equal, or all-zero inputs", () => {
    expect(giniCoefficient([])).toBe(0);
    expect(giniCoefficient([42])).toBe(0);
    expect(giniCoefficient([50, 50, 50])).toBe(0);
    expect(giniCoefficient([0, 0, 0])).toBe(0);
  });

  it("rises with inequality", () => {
    // [0, 10]: absDiff = 20, /(2*2*10) = 0.5
    expect(giniCoefficient([0, 10])).toBeCloseTo(0.5, 5);
    expect(giniCoefficient([10, 90])).toBeGreaterThan(0);
    expect(giniCoefficient([1, 99])).toBeGreaterThan(giniCoefficient([40, 60]));
  });

  it("ignores negative / non-finite values", () => {
    expect(giniCoefficient([50, 50, -5, NaN])).toBe(0);
  });
});

describe("equityFromGini", () => {
  it("maps gini to a 0–100 equity score (100 = perfectly equal)", () => {
    expect(equityFromGini(0)).toBe(100);
    expect(equityFromGini(0.5)).toBe(50);
    expect(equityFromGini(1)).toBe(0);
  });
});

describe("computeEquityBreakdown", () => {
  it("returns perfect equity for equal contributors", () => {
    const out = computeEquityBreakdown([
      {
        participantId: "a",
        overallImpact: 50,
        dimensions: { verbal: 50, decisional: 50, task: 50, collaborative: 50 },
      },
      {
        participantId: "b",
        overallImpact: 50,
        dimensions: { verbal: 50, decisional: 50, task: 50, collaborative: 50 },
      },
    ]);
    expect(out.overall).toBe(100);
    expect(out.gini).toBe(0);
    expect(out.participantCount).toBe(2);
    expect(out.perDimension).toEqual({
      verbal: 100,
      decisional: 100,
      task: 100,
      collaborative: 100,
    });
    expect(out.distribution.map((d) => d.share)).toEqual([50, 50]);
  });

  it("reflects inequality and sorts the distribution by score", () => {
    const out = computeEquityBreakdown([
      {
        participantId: "low",
        participantName: "Low",
        overallImpact: 10,
        dimensions: { verbal: 10 },
      },
      {
        participantId: "high",
        participantName: "High",
        overallImpact: 30,
        dimensions: { verbal: 30 },
      },
    ]);
    expect(out.overall).toBeLessThan(100);
    // total impact 40 → shares 75 / 25, highest first
    expect(out.distribution[0]).toMatchObject({
      participantId: "high",
      share: 75,
    });
    expect(out.distribution[1]).toMatchObject({
      participantId: "low",
      share: 25,
    });
  });

  it("is defensive: empty input → perfectly-equal, empty distribution", () => {
    const out = computeEquityBreakdown([]);
    expect(out.overall).toBe(100);
    expect(out.participantCount).toBe(0);
    expect(out.distribution).toEqual([]);
  });
});
