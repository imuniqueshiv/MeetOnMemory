// ==============================================
// explanationBuilder.js
// Implements FEATURE #270: Explainable AI Memory Retrieval and
// FEATURE #2173: Meeting Search Explainability Panel.
// ==============================================

import { scoreRecency, scoreAiConfidence } from "./importanceScoring.js";

const RECENTLY_ACCESSED_THRESHOLD = 60;

export function confidenceLabel(score) {
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

/**
 * Builds the human-readable retrieval explanation.
 *
 * `searchEvidence` is intentionally a separate, sanitized payload. It is
 * produced only after the caller has applied tenant/authorization filtering.
 */
export function buildExplanation({
  type,
  semanticScore = 0,
  graphScore = 0,
  hops = 0,
  vectorRank = null,
  memory = null,
  organization = null,
  workspace = null,
  searchEvidence = null,
  now = new Date(),
}) {
  const relatesTo = memory?.relatesTo || [];

  const recencyScore = memory
    ? scoreRecency(memory.lastAccessedAt || memory.createdAt, now)
    : null;

  const relationshipConfidence = relatesTo.length
    ? scoreAiConfidence(relatesTo)
    : null;

  const blendedRetrievalConfidence = Math.round(
    (semanticScore * 0.6 + graphScore * 0.4) * 100,
  );
  const confidenceScore = Math.max(
    0,
    Math.min(
      100,
      memory
        ? Math.round(
            blendedRetrievalConfidence * 0.7 +
              (relationshipConfidence ?? 50) * 0.3,
          )
        : blendedRetrievalConfidence,
    ),
  );

  return {
    semanticSimilarity: {
      score: Number(semanticScore.toFixed(3)),
      matched: semanticScore > 0,
    },
    vectorRank,
    graphTraversal: {
      hops,
      matched: hops > 0,
    },
    relatedEntityMatch: hops > 0 || relatesTo.length > 0,
    confidence: {
      score: confidenceScore,
      label: confidenceLabel(confidenceScore),
    },
    recentlyAccessed:
      recencyScore !== null
        ? {
            accessed: recencyScore >= RECENTLY_ACCESSED_THRESHOLD,
            score: Math.round(recencyScore),
          }
        : { accessed: false, score: null },
    organizationRelevance: workspace
      ? {
          workspaceId: workspace.id,
          workspaceName: workspace.name || null,
          workspaceSlug: workspace.slug || null,
          matches: organization
            ? String(workspace.id || "") === String(organization)
            : true,
        }
      : memory && organization
        ? {
            matches: String(memory.organization || "") === String(organization),
          }
        : null,
    searchEvidence,
    retrievalMetadata: {
      type,
      retrievedAt: now.toISOString(),
    },
  };
}
