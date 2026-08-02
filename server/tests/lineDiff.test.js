import { computeLineDiff } from "../utils/lineDiff.js";

describe("computeLineDiff", () => {
  it("marks added and removed lines", () => {
    const result = computeLineDiff("alpha\nbeta\ngamma", "alpha\ndelta\ngamma");

    expect(result.stats.removed).toBe(1);
    expect(result.stats.added).toBe(1);
    expect(result.stats.unchanged).toBe(2);
    expect(result.rows.find((r) => r.type === "remove")?.left).toBe("beta");
    expect(result.rows.find((r) => r.type === "add")?.right).toBe("delta");
  });

  it("returns empty stats for identical text", () => {
    const result = computeLineDiff("one\ntwo", "one\ntwo");
    expect(result.stats).toEqual({ added: 0, removed: 0, unchanged: 2 });
    expect(result.truncated).toBe(false);
  });

  it("truncates when documents exceed maxLines", () => {
    const oldText = Array.from({ length: 5 }, (_, i) => `L${i}`).join("\n");
    const newText = Array.from({ length: 5 }, (_, i) => `N${i}`).join("\n");
    const result = computeLineDiff(oldText, newText, { maxLines: 3 });
    expect(result.truncated).toBe(true);
    expect(result.rows.length).toBeLessThanOrEqual(6);
  });
});
