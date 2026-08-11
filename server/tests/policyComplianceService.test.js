import {
  parseClassification,
  buildClassificationPrompt,
  isPolicyEffectiveForDecision,
} from "../services/policyComplianceService.js";
import fixtures from "./fixtures/policyComplianceFixtures.json" with { type: "json" };

describe("parseClassification", () => {
  test("parses a clean JSON response", () => {
    const raw = JSON.stringify({
      classification: "potential_conflict",
      reasoning: "Exceeds the pre-approval threshold.",
    });
    const result = parseClassification(raw);
    expect(result.classification).toBe("potential_conflict");
    expect(result.reasoning).toBe("Exceeds the pre-approval threshold.");
  });

  test("strips markdown code fences before parsing", () => {
    const raw =
      '```json\n{"classification":"aligned","reasoning":"Matches policy."}\n```';
    const result = parseClassification(raw);
    expect(result.classification).toBe("aligned");
  });

  test("falls back to 'unrelated' for an unrecognized classification value", () => {
    // Guards against the LLM inventing a label outside the enum — a
    // hallucinated classification must never be treated as a valid flag.
    const raw = JSON.stringify({
      classification: "definitely_illegal",
      reasoning: "should not be trusted",
    });
    const result = parseClassification(raw);
    expect(result.classification).toBe("unrelated");
  });

  test("fails conservative (unrelated) on unparsable input", () => {
    // A malformed/empty LLM response must never silently become a conflict flag.
    const result = parseClassification("not valid json at all {{{");
    expect(result.classification).toBe("unrelated");
    expect(result.reasoning).toMatch(/could not be parsed/i);
  });

  test("truncates excessively long reasoning text", () => {
    const longReasoning = "x".repeat(5000);
    const raw = JSON.stringify({
      classification: "references",
      reasoning: longReasoning,
    });
    const result = parseClassification(raw);
    expect(result.reasoning.length).toBeLessThanOrEqual(1000);
  });

  test("handles missing reasoning field gracefully", () => {
    const raw = JSON.stringify({ classification: "unrelated" });
    const result = parseClassification(raw);
    expect(result.classification).toBe("unrelated");
    expect(result.reasoning).toBe("");
  });
});

describe("isPolicyEffectiveForDecision", () => {
  test("excludes policies created after the decision", () => {
    expect(
      isPolicyEffectiveForDecision(
        { createdAt: new Date("2026-06-01T00:00:00.000Z") },
        { createdAt: new Date("2026-05-15T00:00:00.000Z") },
      ),
    ).toBe(false);
  });

  test("includes policies that existed when the decision was recorded", () => {
    expect(
      isPolicyEffectiveForDecision(
        { createdAt: new Date("2026-05-01T00:00:00.000Z") },
        { createdAt: new Date("2026-05-15T00:00:00.000Z") },
      ),
    ).toBe(true);
  });
});

describe("buildClassificationPrompt", () => {
  test("includes the decision text, policy name, version, and summary", () => {
    const policy = {
      name: "Expense Reimbursement Policy",
      version: "2.0",
      summary: "Requires pre-approval above $500.",
      key_changes: ["Raised threshold from $250 to $500"],
    };
    const prompt = buildClassificationPrompt(
      "Approved a $1,200 purchase without pre-approval.",
      policy,
    );

    expect(prompt).toMatch(
      /Approved a \$1,200 purchase without pre-approval\./,
    );
    expect(prompt).toMatch(/Expense Reimbursement Policy/);
    expect(prompt).toMatch(/version 2\.0/);
    expect(prompt).toMatch(/Requires pre-approval above \$500\./);
    expect(prompt).toMatch(/Raised threshold from \$250 to \$500/);
  });

  test("instructs conservative bias against false conflict flags", () => {
    const prompt = buildClassificationPrompt("some decision", {
      name: "Policy",
      version: "1.0",
      summary: "",
      key_changes: [],
    });
    expect(prompt).toMatch(/conservative/i);
    expect(prompt).toMatch(/only use this if genuinely confident/i);
  });

  test("requests strict JSON output matching the four-way enum", () => {
    const prompt = buildClassificationPrompt("some decision", {
      name: "Policy",
      version: "1.0",
      summary: "",
      key_changes: [],
    });
    expect(prompt).toMatch(
      /"aligned" \| "references" \| "potential_conflict" \| "unrelated"/,
    );
  });

  test("handles a policy with no key_changes without throwing", () => {
    expect(() =>
      buildClassificationPrompt("decision text", {
        name: "Policy",
        version: "1.0",
        summary: "summary text",
        key_changes: undefined,
      }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// Hand-labeled fixture set (acceptance criterion: "LLM classification
// prompt (with a small hand-labeled fixture set)"). These assert the
// *prompt* is well-formed for every fixture; running the fixtures against
// a live Gemini call to check actual classification accuracy is done via
// scripts/evalPolicyComplianceFixtures.js against a real GEMINI_API_KEY,
// since that requires network access this sandbox/CI unit run doesn't have.
// ─────────────────────────────────────────────────────────────
describe("hand-labeled fixture set", () => {
  for (const fixture of fixtures) {
    test(`prompt for fixture "${fixture.id}" is well-formed`, () => {
      const prompt = buildClassificationPrompt(
        fixture.decisionText,
        fixture.policy,
      );
      expect(prompt).toMatch(
        new RegExp(fixture.policy.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      expect(prompt.includes(fixture.decisionText)).toBe(true);
      expect(
        ["aligned", "references", "potential_conflict", "unrelated"].includes(
          fixture.expectedClassification,
        ),
      ).toBe(true);
    });
  }

  test("fixture set covers all four classification labels", () => {
    const labels = new Set(fixtures.map((f) => f.expectedClassification));
    expect(labels.has("aligned")).toBe(true);
    expect(labels.has("references")).toBe(true);
    expect(labels.has("potential_conflict")).toBe(true);
    expect(labels.has("unrelated")).toBe(true);
  });
});
