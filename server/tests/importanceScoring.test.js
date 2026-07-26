import {
  IMPORTANCE_WEIGHTS,
  scoreAccessFrequency,
  scoreRecency,
  scoreGraphDegree,
  scoreAiConfidence,
  scoreUserFeedback,
  computeImportanceFactors,
  combineImportanceFactors,
  computeImportanceScore,
} from "../utils/importanceScoring.js";

describe("importanceScoring", () => {
  describe("IMPORTANCE_WEIGHTS", () => {
    it("sums to 1", () => {
      const total = Object.values(IMPORTANCE_WEIGHTS).reduce(
        (sum, w) => sum + w,
        0,
      );
      expect(total).toBeCloseTo(1, 10);
    });
  });

  describe("scoreAccessFrequency", () => {
    it("returns 0 for no accesses", () => {
      expect(scoreAccessFrequency(0)).toBe(0);
    });

    it("scales linearly up to the saturation point", () => {
      expect(scoreAccessFrequency(10)).toBe(50);
    });

    it("caps at 100 beyond the saturation point", () => {
      expect(scoreAccessFrequency(1000)).toBe(100);
    });

    it("treats missing/negative input as 0", () => {
      expect(scoreAccessFrequency(undefined)).toBe(0);
      expect(scoreAccessFrequency(-5)).toBe(0);
    });
  });

  describe("scoreRecency", () => {
    const now = new Date("2026-07-16T00:00:00.000Z");

    it("returns 0 when there is no reference date", () => {
      expect(scoreRecency(null, now)).toBe(0);
    });

    it("returns ~100 for a memory accessed right now", () => {
      expect(scoreRecency(now, now)).toBeCloseTo(100, 5);
    });

    it("decays to ~50 after one half-life (14 days)", () => {
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
      expect(scoreRecency(fourteenDaysAgo, now)).toBeCloseTo(50, 1);
    });

    it("decays to ~25 after two half-lives (28 days)", () => {
      const twentyEightDaysAgo = new Date(now.getTime() - 28 * 86400000);
      expect(scoreRecency(twentyEightDaysAgo, now)).toBeCloseTo(25, 1);
    });
  });

  describe("scoreGraphDegree", () => {
    it("returns 0 for no relationships", () => {
      expect(scoreGraphDegree([])).toBe(0);
      expect(scoreGraphDegree(undefined)).toBe(0);
    });

    it("scales linearly up to the saturation point (5 relationships)", () => {
      expect(scoreGraphDegree([{}, {}])).toBe(40);
    });

    it("caps at 100 beyond the saturation point", () => {
      expect(scoreGraphDegree([{}, {}, {}, {}, {}, {}, {}])).toBe(100);
    });
  });

  describe("scoreAiConfidence", () => {
    it("returns the neutral prior when there are no relationships", () => {
      expect(scoreAiConfidence([])).toBe(50);
    });

    it("averages confidence across relationships", () => {
      expect(scoreAiConfidence([{ confidence: 80 }, { confidence: 60 }])).toBe(
        70,
      );
    });
  });

  describe("scoreUserFeedback", () => {
    it("returns the neutral prior when there is no feedback", () => {
      expect(scoreUserFeedback(0, 0)).toBe(50);
    });

    it("maps a perfect 5-star average to 100", () => {
      expect(scoreUserFeedback(15, 3)).toBe(100);
    });

    it("maps a 1-star average to 0", () => {
      expect(scoreUserFeedback(3, 3)).toBe(0);
    });

    it("maps a 3-star average to 50", () => {
      expect(scoreUserFeedback(9, 3)).toBe(50);
    });
  });

  describe("combineImportanceFactors", () => {
    it("applies the documented weighted formula", () => {
      const factors = {
        accessFrequency: 100,
        recency: 100,
        graphDegree: 100,
        aiConfidence: 100,
        userFeedback: 100,
      };
      expect(combineImportanceFactors(factors)).toBe(100);
    });

    it("weights each factor according to IMPORTANCE_WEIGHTS", () => {
      const factors = {
        accessFrequency: 100,
        recency: 0,
        graphDegree: 0,
        aiConfidence: 0,
        userFeedback: 0,
      };
      expect(combineImportanceFactors(factors)).toBe(30);
    });
  });

  describe("computeImportanceScore", () => {
    const now = new Date("2026-07-16T00:00:00.000Z");

    it("returns a neutral-ish score for a brand-new, unaccessed memory", () => {
      const memory = {
        createdAt: now,
        accessCount: 0,
        relatesTo: [],
        feedbackScore: 0,
        feedbackCount: 0,
      };

      const { score, factors } = computeImportanceScore(memory, now);

      // recency=100 (just created), everything else neutral/zero
      expect(factors.recency).toBeCloseTo(100, 5);
      expect(factors.accessFrequency).toBe(0);
      expect(factors.graphDegree).toBe(0);
      expect(factors.aiConfidence).toBe(50);
      expect(factors.userFeedback).toBe(50);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("scores a heavily-used, well-connected, highly-rated memory near the top", () => {
      const memory = {
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 50,
        relatesTo: [
          { confidence: 90 },
          { confidence: 85 },
          { confidence: 95 },
          { confidence: 88 },
          { confidence: 92 },
        ],
        feedbackScore: 25,
        feedbackCount: 5,
      };

      const { score } = computeImportanceScore(memory, now);
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it("scores a stale, isolated, unused memory near the bottom", () => {
      const staleDate = new Date(now.getTime() - 120 * 86400000); // 120 days ago
      const memory = {
        createdAt: staleDate,
        accessCount: 0,
        relatesTo: [],
        feedbackScore: 0,
        feedbackCount: 0,
      };

      const { score } = computeImportanceScore(memory, now);
      expect(score).toBeLessThan(35);
    });

    it("is deterministic for the same inputs", () => {
      const memory = {
        createdAt: now,
        accessCount: 5,
        relatesTo: [{ confidence: 70 }],
        feedbackScore: 4,
        feedbackCount: 1,
      };

      const first = computeImportanceScore(memory, now);
      const second = computeImportanceScore(memory, now);
      expect(first.score).toBe(second.score);
    });
  });

  describe("computeImportanceFactors", () => {
    it("prefers lastAccessedAt over createdAt for recency", () => {
      const now = new Date("2026-07-16T00:00:00.000Z");
      const oldCreatedAt = new Date(now.getTime() - 60 * 86400000);
      const memory = { createdAt: oldCreatedAt, lastAccessedAt: now };

      const factors = computeImportanceFactors(memory, now);
      expect(factors.recency).toBeCloseTo(100, 5);
    });
  });
});
