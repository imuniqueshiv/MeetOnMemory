import {
  normalizeText,
  tokenize,
  jaccardSimilarity,
  levenshteinDistance,
  levenshteinSimilarity,
  computeTextSimilarity,
} from "../utils/textSimilarity.js";

describe("normalizeText", () => {
  test("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeText("  I LIVE in   Delhi!!  ")).toBe("i live in delhi");
  });

  test("returns empty string for non-string input", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(42)).toBe("");
  });
});

describe("tokenize", () => {
  test("drops stopwords", () => {
    expect(tokenize("I currently stay in Delhi")).toEqual(["stay", "delhi"]);
  });

  test("returns empty array for empty text", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("jaccardSimilarity", () => {
  test("scores paraphrased sentences highly", () => {
    const score = jaccardSimilarity("I live in Delhi", "My home city is Delhi");
    expect(score).toBeGreaterThan(0.2);
  });

  test("scores identical text as 1", () => {
    expect(jaccardSimilarity("Ship the report", "Ship the report")).toBe(1);
  });

  test("scores unrelated text low", () => {
    const score = jaccardSimilarity(
      "I live in Delhi",
      "The server needs a database migration",
    );
    expect(score).toBeLessThan(0.2);
  });

  test("handles empty strings without throwing", () => {
    expect(jaccardSimilarity("", "")).toBe(1);
    expect(jaccardSimilarity("text", "")).toBe(0);
  });
});

describe("levenshteinDistance", () => {
  test("returns 0 for identical strings", () => {
    expect(levenshteinDistance("delhi", "delhi")).toBe(0);
  });

  test("returns string length when one string is empty", () => {
    expect(levenshteinDistance("", "delhi")).toBe(5);
    expect(levenshteinDistance("delhi", "")).toBe(5);
  });

  test("computes edit distance correctly", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });
});

describe("levenshteinSimilarity", () => {
  test("returns 1 for identical normalized text", () => {
    expect(levenshteinSimilarity("Delhi", "delhi")).toBe(1);
  });

  test("returns null for text longer than maxLength", () => {
    const long = "a".repeat(400);
    expect(levenshteinSimilarity(long, long, { maxLength: 300 })).toBeNull();
  });

  test("returns a value between 0 and 1 for partially similar text", () => {
    const score = levenshteinSimilarity("I live in Delhi", "I stay in Delhi");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe("computeTextSimilarity", () => {
  test("scores near-duplicate paraphrases highly", () => {
    const score = computeTextSimilarity(
      "I live in Delhi",
      "I currently stay in Delhi",
    );
    expect(score).toBeGreaterThan(0.35);
  });

  test("scores unrelated sentences low", () => {
    const score = computeTextSimilarity(
      "I live in Delhi",
      "Deploy the new pricing page on Friday",
    );
    expect(score).toBeLessThan(0.3);
  });

  test("falls back to jaccard for very long text", () => {
    const long = "word ".repeat(100);
    const score = computeTextSimilarity(long, long);
    expect(score).toBe(1);
  });
});
