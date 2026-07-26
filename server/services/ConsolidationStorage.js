import { assertSupportedModel } from "./consolidationRegistry.js";
import {
  selectCanonical,
  resolveConflicts,
} from "./Consolidationaiprocessor.js";

/**
 * Merges `relatesTo` edges from duplicates into the canonical record,
 * deduping by target and keeping the highest confidence for any shared
 * target. Skips self-referential edges created by the merge itself.
 */
function mergeRelationships(canonical, duplicates, mergedIdSet) {
  const byTarget = new Map(
    canonical.relatesTo.map((edge) => [edge.target.toString(), edge]),
  );

  for (const duplicate of duplicates) {
    for (const edge of duplicate.relatesTo || []) {
      const targetId = edge.target.toString();
      if (targetId === canonical._id.toString()) continue; // would self-loop
      if (mergedIdSet.has(targetId)) continue; // duplicate merging into itself/cluster

      const existing = byTarget.get(targetId);
      if (!existing || edge.confidence > existing.confidence) {
        byTarget.set(targetId, {
          target: edge.target,
          confidence: edge.confidence,
          computedAt: edge.computedAt || new Date(),
        });
      }
    }
  }

  canonical.relatesTo = [...byTarget.values()];
}

/**
 * Merges one cluster of duplicate memories into a single canonical record.
 * Returns a summary of the merge. When `dryRun` is true, no writes happen
 * and the summary describes what *would* be merged.
 */
export async function mergeCluster(modelType, cluster, { dryRun = true } = {}) {
  if (!cluster || cluster.length < 2) return null;
  const { Model } = assertSupportedModel(modelType);

  const canonical = selectCanonical(cluster);
  const duplicates = cluster.filter(
    (r) => r._id.toString() !== canonical._id.toString(),
  );
  const mergedIdSet = new Set(cluster.map((r) => r._id.toString()));

  // --- Aliases: every distinct phrasing that isn't the canonical text ---
  const existingAliases = new Set(canonical.aliases || []);
  for (const dup of duplicates) {
    if (dup.text && dup.text !== canonical.text) existingAliases.add(dup.text);
    for (const alias of dup.aliases || []) existingAliases.add(alias);
  }
  existingAliases.delete(canonical.text);

  // --- Version history: snapshot each duplicate exactly as it was ---
  const mergeHistoryEntries = duplicates.map((dup) => ({
    originalId: dup._id,
    text: dup.text,
    owner: dup.owner,
    status: dup.status,
    ...(modelType === "actionItem" ? { dueDate: dup.dueDate || null } : {}),
    sourceMeetingId: dup.sourceMeetingId,
    mergedAt: new Date(),
  }));

  const conflicts = resolveConflicts(modelType, canonical, duplicates);
  mergeRelationships(canonical, duplicates, mergedIdSet);

  canonical.aliases = [...existingAliases];
  canonical.mergedFrom = [
    ...(canonical.mergedFrom || []),
    ...duplicates.flatMap((d) => d.mergedFrom || []),
    ...mergeHistoryEntries,
  ];
  canonical.mergeConflicts = [
    ...(canonical.mergeConflicts || []),
    ...conflicts,
  ];
  canonical.lastConsolidatedAt = new Date();

  const summary = {
    modelType,
    canonicalId: canonical._id.toString(),
    canonicalText: canonical.text,
    mergedIds: duplicates.map((d) => d._id.toString()),
    aliasesAdded: [...existingAliases],
    conflicts,
    dryRun,
  };

  if (dryRun) return summary;

  await canonical.save();

  for (const dup of duplicates) {
    dup.supersededByMemory = canonical._id;
    dup.lastConsolidatedAt = new Date();
    // Clear relatesTo on the merged-away record — its relationships now
    // live on the canonical record. The record itself is preserved intact
    // for history via mergedFrom/supersededByMemory, not deleted.
    dup.relatesTo = [];
    await dup.save();
  }

  await repointGraphEdges(
    Model,
    duplicates.map((d) => d._id),
    canonical._id,
  );

  return summary;
}

/**
 * After a cluster has been merged, any *other* document in the collection
 * that still has a `relatesTo` edge pointing at one of the merged-away ids
 * needs to be repointed at the new canonical id — otherwise graph
 * traversals (e.g. getDecisionLineage) would silently dead-end.
 */
export async function repointGraphEdges(Model, mergedAwayIds, canonicalId) {
  const mergedAwaySet = new Set(mergedAwayIds.map((id) => id.toString()));
  if (mergedAwaySet.size === 0) return 0;

  const referencingDocs = await Model.find({
    "relatesTo.target": { $in: [...mergedAwaySet] },
  });

  let updatedCount = 0;
  for (const doc of referencingDocs) {
    const byTarget = new Map();
    for (const edge of doc.relatesTo) {
      const targetId = edge.target.toString();
      const resolvedTarget = mergedAwaySet.has(targetId)
        ? canonicalId.toString()
        : targetId;

      if (resolvedTarget === doc._id.toString()) continue; // avoid self-loop

      const existing = byTarget.get(resolvedTarget);
      if (!existing || edge.confidence > existing.confidence) {
        byTarget.set(resolvedTarget, {
          target: resolvedTarget,
          confidence: edge.confidence,
          computedAt: edge.computedAt || new Date(),
        });
      }
    }
    doc.relatesTo = [...byTarget.values()];
    await doc.save();
    updatedCount += 1;
  }

  return updatedCount;
}

/**
 * Fetches canonical memories that resulted from a consolidation (i.e. have
 * at least one merged alias/history entry), for display/audit purposes.
 */
export async function getConsolidatedMemories(
  modelType,
  { organization = null, limit = 50 } = {},
) {
  const { Model } = assertSupportedModel(modelType);

  return Model.find({
    organization: organization || null,
    "mergedFrom.0": { $exists: true },
  })
    .sort({ lastConsolidatedAt: -1 })
    .limit(Math.min(limit, 200));
}
