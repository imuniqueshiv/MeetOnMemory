/**
 * lifecyclePolicy.js
 *
 * Retention rules for the Memory Lifecycle Management engine (Issue #377).
 *
 * Kept as plain, overridable config (not hard-coded in the service) so
 * retention behaviour can be tuned per-deployment without touching code,
 * per the issue's acceptance criteria. Every threshold can be overridden
 * with an environment variable; defaults are conservative starting points.
 *
 * Days are measured from `lastAccessedAt` (falling back to `createdAt` if a
 * memory has never been accessed).
 */

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const DEFAULT_LIFECYCLE_POLICY = Object.freeze({
  // active -> dormant: no access/feedback in this many days.
  dormantAfterDays: envInt("LIFECYCLE_DORMANT_AFTER_DAYS", 30),
  // dormant -> archived: no access/feedback in this many days.
  archivedAfterDays: envInt("LIFECYCLE_ARCHIVED_AFTER_DAYS", 90),
  // archived -> expired: how long an archived memory sits untouched before
  // it becomes eligible for permanent deletion.
  expiredAfterDays: envInt("LIFECYCLE_EXPIRED_AFTER_DAYS", 365),
  // A memory is never auto-archived/expired while its importanceScore is at
  // or above this threshold, regardless of inactivity — protects high-value
  // knowledge from being swept away just because nobody happened to open it.
  minImportanceScoreToProtect: envInt("LIFECYCLE_PROTECT_IMPORTANCE", 70),
  // Whether the sweep is allowed to hard-delete "expired" memories at all.
  // Off by default: acceptance criteria call this out as a deliberate,
  // reversible-until-the-last-moment step, and the audit log preserves the
  // decision either way.
  hardDeleteExpired: process.env.LIFECYCLE_HARD_DELETE_EXPIRED === "true",
});

export function getLifecyclePolicy(overrides = {}) {
  return { ...DEFAULT_LIFECYCLE_POLICY, ...overrides };
}
