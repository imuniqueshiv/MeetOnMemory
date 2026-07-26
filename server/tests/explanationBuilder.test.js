import {
  buildExplanation,
  confidenceLabel,
} from "../utils/explanationBuilder.js";

describe("explanationBuilder", () => {
  describe("confidenceLabel", () => {
    it("labels scores >= 75 as High", () => {
      expect(confidenceLabel(75)).toBe("High");
      expect(confidenceLabel(100)).toBe("High");
    });
    it("labels scores >= 50 and < 75 as Medium", () => {
      expect(confidenceLabel(50)).toBe("Medium");
      expect(confidenceLabel(74)).toBe("Medium");
    });
    it("labels scores < 50 as Low", () => {
      expect(confidenceLabel(0)).toBe("Low");
      expect(confidenceLabel(49)).toBe("Low");
    });
  });

  describe("buildExplanation", () => {
    it("marks semantic similarity as matched when score > 0", () => {
      const explanation = buildExplanation({
        type: "meeting",
        semanticScore: 0.93,
        vectorRank: 1,
      });
      expect(explanation.semanticSimilarity.matched).toBe(true);
      expect(explanation.semanticSimilarity.score).toBeCloseTo(0.93);
      expect(explanation.vectorRank).toBe(1);
    });

    it("marks semantic similarity as unmatched when score is 0 (graph-only discovery)", () => {
      const explanation = buildExplanation({
        type: "decision",
        semanticScore: 0,
        graphScore: 0.6,
        hops: 1,
      });
      expect(explanation.semanticSimilarity.matched).toBe(false);
      expect(explanation.graphTraversal.matched).toBe(true);
      expect(explanation.graphTraversal.hops).toBe(1);
      expect(explanation.relatedEntityMatch).toBe(true);
    });

    it("reports no graph traversal for a direct semantic hit with no hops", () => {
      const explanation = buildExplanation({
        type: "meeting",
        semanticScore: 0.8,
      });
      expect(explanation.graphTraversal.matched).toBe(false);
      expect(explanation.graphTraversal.hops).toBe(0);
    });

    it("relatedEntityMatch is true if the memory has relationships even with 0 hops", () => {
      const explanation = buildExplanation({
        type: "decision",
        semanticScore: 0.9,
        hops: 0,
        memory: {
          relatesTo: [{ target: "x", confidence: 80 }],
          createdAt: new Date(),
        },
      });
      expect(explanation.relatedEntityMatch).toBe(true);
    });

    it("computes recentlyAccessed from memory.lastAccessedAt using the recency curve", () => {
      const now = new Date("2026-07-18T00:00:00Z");
      const recentlyTouched = buildExplanation({
        type: "decision",
        semanticScore: 0.5,
        memory: { lastAccessedAt: new Date("2026-07-17T00:00:00Z") },
        now,
      });
      const longUntouched = buildExplanation({
        type: "decision",
        semanticScore: 0.5,
        memory: { lastAccessedAt: new Date("2026-01-01T00:00:00Z") },
        now,
      });

      expect(recentlyTouched.recentlyAccessed.accessed).toBe(true);
      expect(longUntouched.recentlyAccessed.accessed).toBe(false);
    });

    it("reports recentlyAccessed as not accessed (null score) for meetings with no memory data", () => {
      const explanation = buildExplanation({
        type: "meeting",
        semanticScore: 0.5,
      });
      expect(explanation.recentlyAccessed).toEqual({
        accessed: false,
        score: null,
      });
    });

    it("omits organizationRelevance when there is no memory or no organization", () => {
      const noMemory = buildExplanation({
        type: "meeting",
        semanticScore: 0.5,
      });
      expect(noMemory.organizationRelevance).toBeNull();

      const noOrgProvided = buildExplanation({
        type: "decision",
        semanticScore: 0.5,
        memory: { organization: "org-1" },
      });
      expect(noOrgProvided.organizationRelevance).toBeNull();
    });

    it("reports organizationRelevance.matches correctly when both are provided", () => {
      const matching = buildExplanation({
        type: "decision",
        semanticScore: 0.5,
        memory: { organization: "org-1" },
        organization: "org-1",
      });
      const mismatched = buildExplanation({
        type: "decision",
        semanticScore: 0.5,
        memory: { organization: "org-1" },
        organization: "org-2",
      });
      expect(matching.organizationRelevance).toEqual({ matches: true });
      expect(mismatched.organizationRelevance).toEqual({ matches: false });
    });

    it("keeps confidence within 0-100 and produces a consistent label", () => {
      const explanation = buildExplanation({
        type: "decision",
        semanticScore: 1,
        graphScore: 1,
        memory: { relatesTo: [{ target: "x", confidence: 100 }] },
      });
      expect(explanation.confidence.score).toBeLessThanOrEqual(100);
      expect(explanation.confidence.score).toBeGreaterThanOrEqual(0);
      expect(explanation.confidence.label).toBe(
        confidenceLabel(explanation.confidence.score),
      );
    });

    it("includes retrievalMetadata with the type and an ISO timestamp", () => {
      const now = new Date("2026-07-18T12:00:00Z");
      const explanation = buildExplanation({
        type: "actionItem",
        semanticScore: 0.4,
        now,
      });
      expect(explanation.retrievalMetadata).toEqual({
        type: "actionItem",
        retrievedAt: now.toISOString(),
      });
    });
  });
});
