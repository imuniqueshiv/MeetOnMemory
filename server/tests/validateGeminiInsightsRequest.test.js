import { validateGeminiInsightsRequest } from "../utils/validateGeminiInsightsRequest.js";

describe("validateGeminiInsightsRequest", () => {
  it("accepts a non-empty plain object summary", () => {
    const result = validateGeminiInsightsRequest({
      summary: { totalMeetings: 3 },
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects missing summary", () => {
    const result = validateGeminiInsightsRequest({});
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Summary is required.");
  });

  it("rejects array summary", () => {
    const result = validateGeminiInsightsRequest({ summary: [1, 2] });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Summary must be a plain object.");
  });

  it("rejects empty object summary", () => {
    const result = validateGeminiInsightsRequest({ summary: {} });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Summary must not be empty.");
  });

  it("rejects oversized summary", () => {
    const result = validateGeminiInsightsRequest({
      summary: { blob: "x".repeat(10_001) },
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("must not exceed"))).toBe(true);
  });
});
