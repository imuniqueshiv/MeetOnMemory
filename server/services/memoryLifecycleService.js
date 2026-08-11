/**
 * memoryLifecycleService.js
 *
 * Memory Lifecycle Management engine (Issue #377).
 *
 * Applies configurable retention policies (see config/lifecyclePolicy.js) to
 * Decision / ActionItem documents, classifying each into one of four
 * states:
 *
 *   active   -> recently accessed / high importance, shown by default.
 *   dormant  -> inactive for a while, still shown but flagged as low-usage.
 *   archived -> excluded from default retrieval, still searchable/restorable.
 *   expired  -> eligible for permanent deletion on a future sweep.
 *
 * Design mirrors importanceScoringService.js: a pure "evaluate" function
 * decides the target state from plain data, a "transition" function
 * persists it (and appends to lifecycleHistory for auditability), and a
 * batched "sweep" function runs both across a collection so it can be
 * called from an admin endpoint or a scheduled job.
 *
 * Memories are never deleted implicitly — a document only leaves the
 * database if hardDeleteExpired is explicitly enabled AND the sweep finds
 * it already sitting in the "expired" state, mirroring how
 * memoryConsolidationService.js treats destructive operations as opt-in.
 */

import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import { getLifecyclePolicy } from "../config/lifecyclePolicy.js";

const MODELS = {
  decision: Decision,
  actionItem: ActionItem,
};

const STATES = ["active", "dormant", "archived", "expired"];

function resolveModel(type) {
  const Model = MODELS[type];
  if (!Model) {
    throw new Error(`Unknown memory type: ${type}`);
  }
  return Model;
}

function daysBetween(a, b) {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Pure function: given a plain-data view of a memory and a policy, decides
 * what lifecycle state it *should* be in right now. Never reads/writes the
 * DB, so it's trivially unit-testable.
 *
 * Only ever recommends "forward" transitions (active -> dormant -> archived
 * -> expired) or "expired -> archived" is done separately via restore, not
 * here — reviving a memory always goes through restoreMemory() so the
 * access that triggered it is recorded consistently.
 */
export function evaluateLifecycleState(memory, policy = getLifecyclePolicy()) {
  const now = memory.__now instanceof Date ? memory.__now : new Date();
  const currentState = memory.lifecycleState || "active";
  const reference = memory.lastAccessedAt || memory.createdAt || now;
  const inactiveDays = daysBetween(now, reference);
  const importanceScore = memory.importanceScore || 0;

  // High-value memories are protected from automatic archival/expiry no
  // matter how inactive they look, but can still be marked dormant as a
  // soft signal.
  const protectedFromArchival =
    importanceScore >= policy.minImportanceScoreToProtect;

  if (currentState === "expired") {
    // Terminal unless explicitly restored.
    return { state: "expired", reason: null };
  }

  if (currentState === "archived") {
    if (inactiveDays >= policy.expiredAfterDays) {
      return {
        state: "expired",
        reason: `Archived and inactive for ${Math.floor(inactiveDays)} days (>= ${policy.expiredAfterDays})`,
      };
    }
    return { state: "archived", reason: null };
  }

  if (!protectedFromArchival && inactiveDays >= policy.archivedAfterDays) {
    return {
      state: "archived",
      reason: `Inactive for ${Math.floor(inactiveDays)} days (>= ${policy.archivedAfterDays}), importance ${importanceScore}`,
    };
  }

  if (inactiveDays >= policy.dormantAfterDays) {
    return {
      state: "dormant",
      reason: `Inactive for ${Math.floor(inactiveDays)} days (>= ${policy.dormantAfterDays})`,
    };
  }

  return { state: "active", reason: null };
}

/**
 * Persists a lifecycle transition on an already-loaded document, appending
 * an entry to lifecycleHistory. No-ops (but still returns the document) if
 * the state is unchanged, so callers can call this unconditionally.
 */
export async function transitionLifecycleState(
  document,
  toState,
  { reason = "", triggeredBy = "system" } = {},
) {
  if (!STATES.includes(toState)) {
    throw new Error(`Unknown lifecycle state: ${toState}`);
  }

  const fromState = document.lifecycleState || "active";
  if (fromState === toState) {
    return document;
  }

  document.lifecycleHistory.push({
    from: fromState,
    to: toState,
    reason,
    triggeredBy,
    transitionedAt: new Date(),
  });

  document.lifecycleState = toState;
  document.lifecycleUpdatedAt = new Date();
  document.archivedAt =
    toState === "archived" ? new Date() : document.archivedAt;

  await document.save();
  return document;
}

/**
 * Manually (or intelligently, e.g. on access) restores a memory back to
 * "active", regardless of which state it was in — including "expired",
 * as long as the document still exists (hard-deletion is the only
 * irreversible step in this system).
 */
export async function restoreMemory(
  type,
  id,
  { triggeredBy = "system", reason = "Restored on reference" } = {},
) {
  const Model = resolveModel(type);
  const document = await Model.findById(id);
  if (!document) return null;

  if ((document.lifecycleState || "active") === "active") {
    return document;
  }

  return transitionLifecycleState(document, "active", { reason, triggeredBy });
}

/**
 * Batch-evaluates and transitions every memory of the given type
 * (optionally scoped to an organization), running in small batches so it
 * stays reasonable on large collections. Returns a summary report,
 * including any permanent deletions if hardDeleteExpired is enabled.
 */
export async function runLifecycleSweep({
  organization = undefined,
  policyOverrides = {},
  batchSize = 200,
} = {}) {
  const policy = getLifecyclePolicy(policyOverrides);
  const filter = organization === undefined ? {} : { organization };

  const summary = {
    scanned: 0,
    transitions: { toDormant: 0, toArchived: 0, toExpired: 0 },
    deleted: 0,
    policy,
  };

  for (const [, Model] of Object.entries(MODELS)) {
    let skip = 0;
    const now = new Date();

    while (true) {
      const batch = await Model.find(filter).skip(skip).limit(batchSize);
      if (batch.length === 0) break;

      for (const doc of batch) {
        summary.scanned += 1;
        doc.__now = now; // scoped hint for evaluateLifecycleState, not persisted

        const { state, reason } = evaluateLifecycleState(doc, policy);

        if (
          state === "expired" &&
          (doc.lifecycleState || "active") === "expired"
        ) {
          if (policy.hardDeleteExpired) {
            await Model.deleteOne({ _id: doc._id });
            summary.deleted += 1;
          }
          continue;
        }

        if (state !== (doc.lifecycleState || "active")) {
          await transitionLifecycleState(doc, state, {
            reason,
            triggeredBy: "system",
          });
          if (state === "dormant") summary.transitions.toDormant += 1;
          if (state === "archived") summary.transitions.toArchived += 1;
          if (state === "expired") summary.transitions.toExpired += 1;
        }
      }

      if (batch.length < batchSize) break;
      skip += batchSize;
    }
  }

  return summary;
}

export default {
  evaluateLifecycleState,
  transitionLifecycleState,
  restoreMemory,
  runLifecycleSweep,
};
