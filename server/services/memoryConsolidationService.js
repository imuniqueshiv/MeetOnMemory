// ==============================================
// 📘 memoryConsolidationService.js
// AI-Powered Memory Consolidation Engine
//
// The knowledge graph stores "memories" as Decision and ActionItem
// documents (see knowledgeGraphService.js). As meetings accumulate, the
// same fact often gets re-recorded with different wording
// ("I live in Delhi" / "My home city is Delhi" / "I currently stay in
// Delhi"). This service finds those duplicate/near-duplicate memories,
// merges them into a single canonical record, and preserves everything
// that made the duplicates meaningful: aliases, relationships (graph
// edges), version history, and any conflicting metadata.
//
// Design notes:
// - Runs per-model (Decision, ActionItem) and per-organization so
//   multi-tenant isolation matches the rest of the knowledge graph.
// - Never deletes documents. Merged-away memories are kept with
//   `supersededByMemory` pointing at the canonical record, so anything
//   that still references their _id (audit logs, exports, direct links)
//   keeps working. This also means it never changes existing read APIs
//   for callers that don't yet know about consolidation.
// - Clustering uses union-find so transitive duplicates
//   (A~B, B~C => A~B~C) are merged together in one pass.
// ==============================================

import {
  MODEL_REGISTRY,
  assertSupportedModel,
} from "./consolidation/consolidationRegistry.js";
import {
  DEFAULT_EMBEDDING_THRESHOLD,
  DEFAULT_TEXT_THRESHOLD,
  areMemoriesSimilar,
  selectCanonical,
} from "./consolidation/ConsolidationAIProcessor.js";
import {
  buildDuplicateClusters,
  fetchMemoriesForConsolidation,
} from "./consolidation/MemoryAggregator.js";
import {
  mergeCluster,
  getConsolidatedMemories,
  repointGraphEdges,
} from "./consolidation/ConsolidationStorage.js";

/**
 * Runs the full consolidation pipeline for a single memory type, scoped to
 * an organization (or global/null-org memories).
 */
export async function consolidateModel(
  modelType,
  {
    organization = null,
    dryRun = true,
    embeddingThreshold,
    textThreshold,
  } = {},
) {
  const { Model } = assertSupportedModel(modelType);

  // Only consider active, still-canonical memories as clustering input —
  // records already merged away shouldn't be re-clustered.
  const records = await fetchMemoriesForConsolidation(Model, organization);

  const clusters = buildDuplicateClusters(records, {
    embeddingThreshold,
    textThreshold,
  });

  const mergeSummaries = [];
  for (const cluster of clusters) {
    const summary = await mergeCluster(modelType, cluster, { dryRun });
    if (summary) mergeSummaries.push(summary);
  }

  return {
    modelType,
    recordsScanned: records.length,
    clustersFound: clusters.length,
    merges: mergeSummaries,
  };
}

/**
 * Entry point for the Memory Consolidation Engine. Runs across the
 * requested memory types (default: all supported types) for a given
 * organization and returns a combined report.
 */
export async function consolidateMemories({
  organization = null,
  dryRun = true,
  models = Object.keys(MODEL_REGISTRY),
  embeddingThreshold = DEFAULT_EMBEDDING_THRESHOLD,
  textThreshold = DEFAULT_TEXT_THRESHOLD,
} = {}) {
  const invalidModels = models.filter((m) => !MODEL_REGISTRY[m]);
  if (invalidModels.length) {
    throw new Error(`Unsupported memory type(s): ${invalidModels.join(", ")}`);
  }

  const results = {};
  for (const modelType of models) {
    results[modelType] = await consolidateModel(modelType, {
      organization,
      dryRun,
      embeddingThreshold,
      textThreshold,
    });
  }

  const totalClustersFound = Object.values(results).reduce(
    (sum, r) => sum + r.clustersFound,
    0,
  );
  const totalMerged = Object.values(results).reduce(
    (sum, r) => sum + r.merges.length,
    0,
  );

  return {
    dryRun,
    organization: organization ? organization.toString() : null,
    totalClustersFound,
    totalMerged,
    results,
  };
}

export {
  MODEL_REGISTRY,
  DEFAULT_EMBEDDING_THRESHOLD,
  DEFAULT_TEXT_THRESHOLD,
  getConsolidatedMemories,
  buildDuplicateClusters,
  mergeCluster,
  repointGraphEdges,
  areMemoriesSimilar,
  selectCanonical,
};
