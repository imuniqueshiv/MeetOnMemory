// ==============================================
// 📘 ConflictStorage.js
// Persistence layer for the Contradiction Detection engine: turns
// clusters produced by ConflictAggregator into ConflictSet documents,
// dedupes against conflicts already under review, and applies a user's
// resolution back onto the knowledge graph.
// ==============================================
import mongoose from "mongoose";
import ConflictSet from "../../models/conflictModel.js";
import { assertSupportedModel } from "../consolidation/consolidationRegistry.js";

const VALID_CONFLICT_STATUSES = new Set([
  "open",
  "resolved",
  "dismissed",
  "all",
]);

function snapshotMember(record) {
  return {
    memoryId: record._id,
    text: record.text,
    owner: record.owner || "",
    status: record.status || "",
    sourceMeetingId: record.sourceMeetingId || null,
    capturedAt: new Date(),
  };
}

/**
 * Finds an existing *open* conflict set that already covers this exact
 * member group, so repeated background scans update rather than
 * duplicate it (acceptance criterion: "Conflicts are grouped without
 * creating duplicates").
 */
async function findOpenConflictForMembers(modelType, organization, memberIds) {
  const sortedIds = memberIds.map((id) => id.toString()).sort();

  const candidates = await ConflictSet.find({
    organization: organization || null,
    modelType,
    status: "open",
    memberIds: { $all: sortedIds },
  });

  return (
    candidates.find((c) => {
      const existingIds = c.memberIds.map((id) => id.toString()).sort();
      return (
        existingIds.length === sortedIds.length &&
        existingIds.every((id, i) => id === sortedIds[i])
      );
    }) || null
  );
}

/**
 * Persists (or updates) a single cluster as a ConflictSet. When `dryRun`
 * is true, no writes happen and the summary describes what *would* be
 * stored, matching the Consolidation engine's preview convention.
 */
export async function storeConflictCluster(
  modelType,
  cluster,
  pairwiseConflicts,
  { organization = null, dryRun = true } = {},
) {
  if (!cluster || cluster.length < 2) return null;

  const memberIds = cluster.map((r) => r._id);
  const confidence = Math.max(...pairwiseConflicts.map((p) => p.confidence), 0);
  const explanation =
    pairwiseConflicts.find((p) => p.explanation)?.explanation ||
    "Conflicting values detected across these memories.";

  const summary = {
    modelType,
    memberIds: memberIds.map((id) => id.toString()),
    memberTexts: cluster.map((r) => r.text),
    confidence,
    explanation,
    pairwiseCount: pairwiseConflicts.length,
    dryRun,
  };

  if (dryRun) return summary;

  const existing = await findOpenConflictForMembers(
    modelType,
    organization,
    memberIds,
  );

  const pairwiseForStorage = pairwiseConflicts.map((p) => ({
    memberA: p.memberA,
    memberB: p.memberB,
    confidence: p.confidence,
    signals: p.signals,
    explanation: p.explanation,
    source: p.source,
  }));
  const memberSnapshots = cluster.map(snapshotMember);

  if (existing) {
    existing.pairwiseConflicts = pairwiseForStorage;
    existing.memberSnapshots = memberSnapshots;
    existing.confidence = confidence;
    existing.explanation = explanation;
    existing.lastScannedAt = new Date();
    await existing.save();
    summary.conflictSetId = existing._id.toString();
    summary.wasNew = false;
    return summary;
  }

  const created = await ConflictSet.create({
    organization,
    modelType,
    memberIds,
    memberSnapshots,
    pairwiseConflicts: pairwiseForStorage,
    confidence,
    explanation,
    status: "open",
    detectedAt: new Date(),
    lastScannedAt: new Date(),
  });

  summary.conflictSetId = created._id.toString();
  summary.wasNew = true;
  return summary;
}

/**
 * Applies a resolution to a conflict set:
 *  - "kept_member": the chosen memory is marked authoritative; the other
 *    members are marked resolved-away via `supersededByMemory`-style
 *    pointer, but — unlike Consolidation — their content is preserved
 *    untouched (they were never duplicates, just wrong at a point in
 *    time), so `conflictResolution` records the outcome without erasing
 *    the record.
 *  - "custom_value": none of the existing memories were fully correct;
 *    the user supplies the true value as free text, stored on the
 *    conflict set itself (no single memory can safely be crowned canonical).
 *  - "dismissed": reviewed and judged not to be an actual contradiction
 *    (e.g. sequential updates, not a conflict).
 *
 * In every case, the conflict set retains full history: the pre-
 * resolution snapshots plus the applied resolution, so audits can see
 * both what was flagged and what was decided.
 */
export async function resolveConflictSet(
  conflictId,
  {
    resolutionType,
    keptMemoryId = null,
    customValue = "",
    note = "",
    resolvedBy = null,
  } = {},
) {
  const conflict = await ConflictSet.findById(conflictId);
  if (!conflict) {
    throw new Error("Conflict set not found");
  }
  if (conflict.status !== "open") {
    throw new Error(`Conflict set is already ${conflict.status}`);
  }

  const validTypes = ["kept_member", "custom_value", "dismissed"];
  if (!validTypes.includes(resolutionType)) {
    throw new Error(
      `Invalid resolutionType "${resolutionType}". Expected one of: ${validTypes.join(", ")}`,
    );
  }

  if (resolutionType === "kept_member") {
    const isMember = conflict.memberIds.some(
      (id) => id.toString() === String(keptMemoryId),
    );
    if (!keptMemoryId || !isMember) {
      throw new Error(
        "keptMemoryId must reference one of this conflict set's members",
      );
    }

    const { Model } = assertSupportedModel(conflict.modelType);
    const losingIds = conflict.memberIds.filter(
      (id) => id.toString() !== String(keptMemoryId),
    );

    const winner = await Model.findById(keptMemoryId);
    if (winner) {
      winner.status = winner.status === "superseded" ? "open" : winner.status;
      await winner.save();
    }

    for (const losingId of losingIds) {
      const losing = await Model.findById(losingId);
      if (!losing) continue;
      // Preserve the record (never delete), but mark it as the losing
      // side of a resolved conflict, distinct from Consolidation's
      // duplicate-merge `supersededByMemory` semantics.
      losing.status = "superseded";
      losing.supersededByMemory = keptMemoryId;
      await losing.save();
    }
  }

  conflict.status = resolutionType === "dismissed" ? "dismissed" : "resolved";
  conflict.resolution = {
    type: resolutionType,
    keptMemoryId: resolutionType === "kept_member" ? keptMemoryId : null,
    customValue: resolutionType === "custom_value" ? customValue : "",
    note,
    resolvedBy,
    resolvedAt: new Date(),
  };

  await conflict.save();
  return conflict;
}

export async function listConflictSets(
  modelType,
  { organization = null, status = "open", limit = 50 } = {},
) {
  const query = {};

  if (organization === null) {
    query.organization = null;
  } else if (
    typeof organization === "string" &&
    mongoose.Types.ObjectId.isValid(organization)
  ) {
    query.organization = organization;
  } else if (organization instanceof mongoose.Types.ObjectId) {
    query.organization = organization;
  }

  if (typeof modelType === "string" && modelType.trim() !== "") {
    query.modelType = modelType;
  }

  if (
    typeof status === "string" &&
    VALID_CONFLICT_STATUSES.has(status) &&
    status !== "all"
  ) {
    query.status = status;
  }

  const safeLimit =
    Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;

  return ConflictSet.find(query)
    .sort({ confidence: -1, detectedAt: -1 })
    .limit(safeLimit);
}

export async function getConflictSetById(conflictId) {
  return ConflictSet.findById(conflictId);
}
