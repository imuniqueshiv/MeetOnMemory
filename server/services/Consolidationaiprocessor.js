import { cosineSimilarity } from "../../utils/similarity.js";
import { computeTextSimilarity } from "../../utils/textSimilarity.js";
import { assertSupportedModel } from "./consolidationRegistry.js";

export const DEFAULT_EMBEDDING_THRESHOLD = 0.9;
export const DEFAULT_TEXT_THRESHOLD = 0.82;

// resolved/superseded are "terminal" states — if any duplicate reached one,
// the canonical memory should reflect that, since they describe the same
// underlying fact/task.
const STATUS_PRECEDENCE = ["open", "in-progress", "resolved", "superseded"];

/**
 * Pairwise-compares similarity score between two memory records using
 * embeddings first (more semantically robust), falling back to / boosted
 * by lexical paraphrase similarity when embeddings are unavailable or
 * inconclusive.
 */
export function areMemoriesSimilar(
  recordA,
  recordB,
  {
    embeddingThreshold = DEFAULT_EMBEDDING_THRESHOLD,
    textThreshold = DEFAULT_TEXT_THRESHOLD,
  } = {},
) {
  const hasEmbeddings =
    recordA.embedding?.length &&
    recordB.embedding?.length &&
    recordA.embedding.length === recordB.embedding.length;

  const embeddingScore = hasEmbeddings
    ? cosineSimilarity(recordA.embedding, recordB.embedding)
    : 0;

  const textScore = computeTextSimilarity(recordA.text, recordB.text);

  const isDuplicate =
    (hasEmbeddings && embeddingScore >= embeddingThreshold) ||
    textScore >= textThreshold;

  return {
    isDuplicate,
    embeddingScore,
    textScore,
    // Best available signal, useful for ranking/debugging.
    combinedScore: Math.max(hasEmbeddings ? embeddingScore : 0, textScore),
  };
}

/**
 * Chooses the canonical record for a cluster of duplicate memories.
 * Preference order:
 *   1. Earliest created — the first time this fact/task entered the graph.
 *   2. Most existing relationships — already the most "connected" node,
 *      so repointing edges elsewhere would lose more context.
 *   3. Longest text — tends to be the most descriptive phrasing.
 */
export function selectCanonical(cluster) {
  return [...cluster].sort((a, b) => {
    const createdDiff = new Date(a.createdAt) - new Date(b.createdAt);
    if (createdDiff !== 0) return createdDiff;

    const relDiff = (b.relatesTo?.length || 0) - (a.relatesTo?.length || 0);
    if (relDiff !== 0) return relDiff;

    return (b.text?.length || 0) - (a.text?.length || 0);
  })[0];
}

/**
 * Resolves a single conflicting field between the canonical record and its
 * duplicates. Returns { value, changed, values } — `values` lists every
 * distinct value seen, for the audit trail.
 */
function resolveField(field, canonical, duplicates) {
  const all = [canonical, ...duplicates];
  const distinctValues = [
    ...new Set(all.map((r) => serializeFieldValue(r[field]))),
  ];

  if (distinctValues.length <= 1) {
    return { value: canonical[field], changed: false, values: distinctValues };
  }

  let resolvedValue = canonical[field];

  if (field === "status") {
    resolvedValue = all
      .map((r) => r.status)
      .reduce((best, current) =>
        STATUS_PRECEDENCE.indexOf(current) > STATUS_PRECEDENCE.indexOf(best)
          ? current
          : best,
      );
  } else if (field === "owner") {
    // Prefer a real, assigned owner over the empty/"Unassigned" default.
    const isDefaultOwner = (o) => !o || o === "Unassigned";
    const assigned = all.map((r) => r.owner).find((o) => !isDefaultOwner(o));
    resolvedValue = assigned || canonical.owner;
  } else if (field === "dueDate") {
    // Keep the earliest non-null deadline — the more conservative choice.
    const dates = all
      .map((r) => r.dueDate)
      .filter(Boolean)
      .map((d) => new Date(d));
    resolvedValue = dates.length
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : null;
  }

  const changed =
    serializeFieldValue(resolvedValue) !==
    serializeFieldValue(canonical[field]);

  return { value: resolvedValue, changed, values: distinctValues };
}

function serializeFieldValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Applies conflict resolution across the configured fields for a memory
 * type, mutating `canonical` in place and returning the list of conflict
 * records to store on `mergeConflicts`.
 */
export function resolveConflicts(modelType, canonical, duplicates) {
  const { conflictFields } = assertSupportedModel(modelType);
  const conflicts = [];

  for (const field of conflictFields) {
    const { value, changed, values } = resolveField(
      field,
      canonical,
      duplicates,
    );
    if (values.length > 1) {
      conflicts.push({
        field,
        values,
        resolution: `Resolved to "${serializeFieldValue(value)}"`,
        resolvedAt: new Date(),
      });
    }
    if (changed) canonical[field] = value;
  }

  return conflicts;
}
