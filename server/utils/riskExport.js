/**
 * Risk register export + status workflow helpers (Issue #2463).
 *
 * Pure, IO-free: a CSV serializer for a risk set and the allowed mitigation
 * status transitions. Unit-tested.
 */

export const RISK_STATUSES = ["Open", "Mitigated", "Closed", "Realized"];

// Allowed mitigation status transitions (a closure loop, with reopen paths).
export const RISK_STATUS_TRANSITIONS = {
  Open: ["Mitigated", "Realized", "Closed"],
  Mitigated: ["Closed", "Realized", "Open"],
  Realized: ["Closed", "Mitigated"],
  Closed: ["Open"],
};

/** Whether a risk may move from `from` to `to` (a no-op to the same status is allowed). */
export function isValidRiskTransition(from, to) {
  if (!RISK_STATUSES.includes(to)) return false;
  if (from === to) return true;
  return (RISK_STATUS_TRANSITIONS[from] || []).includes(to);
}

const CSV_COLUMNS = [
  ["title", "Title"],
  ["category", "Category"],
  ["status", "Status"],
  ["probability", "Probability"],
  ["impact", "Impact"],
  ["riskScore", "Score"],
  ["owner", "Owner"],
  ["mitigationPlan", "Mitigation Plan"],
  ["description", "Description"],
];

/** RFC-4180 field escaping: wrap in quotes and double embedded quotes when needed. */
function csvField(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const ownerName = (owner) => {
  if (!owner || typeof owner !== "object") return "";
  return `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim();
};

/** Serialize a list of risks to a CSV string (header + one row per risk). */
export function risksToCsv(risks) {
  const list = Array.isArray(risks) ? risks : [];
  const header = CSV_COLUMNS.map(([, label]) => csvField(label)).join(",");
  const rows = list.map((risk) =>
    CSV_COLUMNS.map(([key]) => {
      const value = key === "owner" ? ownerName(risk?.ownerId) : risk?.[key];
      return csvField(value);
    }).join(","),
  );
  return [header, ...rows].join("\n");
}
