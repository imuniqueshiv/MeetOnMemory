import {
  risksToCsv,
  isValidRiskTransition,
  RISK_STATUS_TRANSITIONS,
} from "../utils/riskExport.js";

describe("risksToCsv (Issue #2463)", () => {
  it("emits a header and one row per risk, with owner name resolved", () => {
    const csv = risksToCsv([
      {
        title: "Vendor delay",
        category: "Schedule",
        status: "Open",
        probability: 4,
        impact: 3,
        riskScore: 12,
        ownerId: { firstName: "Ada", lastName: "Lovelace" },
        mitigationPlan: "Add buffer",
        description: "Vendor may slip",
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Title,Category,Status,Probability,Impact,Score,Owner,Mitigation Plan,Description",
    );
    expect(lines[1]).toBe(
      "Vendor delay,Schedule,Open,4,3,12,Ada Lovelace,Add buffer,Vendor may slip",
    );
  });

  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const csv = risksToCsv([
      {
        title: 'Risk, with "comma"',
        description: "line1\nline2",
        status: "Open",
      },
    ]);
    const row = csv.split("\n").slice(1).join("\n");
    expect(row).toContain('"Risk, with ""comma"""');
    expect(row).toContain('"line1\nline2"');
  });

  it("returns just the header for an empty or non-array input", () => {
    expect(risksToCsv([]).split("\n")).toHaveLength(1);
    expect(risksToCsv(null).split("\n")).toHaveLength(1);
  });
});

describe("isValidRiskTransition", () => {
  it("allows defined transitions and same-status no-ops", () => {
    expect(isValidRiskTransition("Open", "Mitigated")).toBe(true);
    expect(isValidRiskTransition("Mitigated", "Closed")).toBe(true);
    expect(isValidRiskTransition("Closed", "Open")).toBe(true); // reopen
    expect(isValidRiskTransition("Open", "Open")).toBe(true);
  });

  it("rejects undefined transitions and unknown statuses", () => {
    expect(isValidRiskTransition("Closed", "Mitigated")).toBe(false);
    expect(isValidRiskTransition("Realized", "Open")).toBe(false);
    expect(isValidRiskTransition("Open", "Banana")).toBe(false);
  });

  it("every listed target is a valid status", () => {
    const valid = new Set(["Open", "Mitigated", "Closed", "Realized"]);
    for (const targets of Object.values(RISK_STATUS_TRANSITIONS)) {
      for (const t of targets) expect(valid.has(t)).toBe(true);
    }
  });
});
