// ==============================================
// explanationBuilder.js
// Implements FEATURE #270: Explainable AI Memory Retrieval.
//
// Turns the raw signals already computed during retrieval (semantic
// similarity, graph traversal hops, access history, relationship
// confidence) into a human-readable "why was this returned?" explanation
// object, without exposing internal implementation details (embeddings,
// raw DB documents, etc).
//
// Deliberately reuses the existing importance-scoring primitives
// (utils/importanceScoring.js) instead of re-deriving recency/confidence
// logic, so the two features stay consistent with each other.
// ==============================================

import { scoreRecency, scoreAiConfidence } from "./importanceScoring.js";

// A memory is considered "recently accessed" once its recency score
// (0-100, exponential decay - see importanceScoring.js) crosses this
// threshold. With the 14-day half-life used there, ~60 corresponds to
// roughly the last week.
const RECENTLY_ACCESSED_THRESHOLD = 60;

export function confidenceLabel(score) {
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

/**
 * Builds an explanation object for a single retrieval result.
 *
 * @param {object} params
 * @param {"meeting"|"decision"|"actionItem"} params.type
 * @param {number} [params.semanticScore=0] - 0-1 cosine similarity / vector match
 * @param {number} [params.graphScore=0] - 0-1 graph-connectivity score (0 for direct semantic hits)
 * @param {number} [params.hops=0] - knowledge-graph hops from a semantic seed (0 = direct match)
 * @param {number|null} [params.vectorRank=null] - 1-based rank in the semantic search results
 * @param {object|null} [params.memory=null] - decision/action-item metadata (relatesTo,
 *   accessCount, lastAccessedAt, feedbackScore, feedbackCount, organization). null for
 *   meetings, which don't carry this data today.
 * @param {string|null} [params.organization=null] - the requesting user's organization,
 *   for the "organization relevance" check.
 * @param {Date} [params.now=new Date()] - injection point for deterministic tests.
 */
export function buildExplanation({
  type,
  semanticScore = 0,
  graphScore = 0,
  hops = 0,
  vectorRank = null,
  memory = null,
  organization = null,
  now = new Date(),
}) {
  const relatesTo = memory?.relatesTo || [];

  const recencyScore = memory
    ? scoreRecency(memory.lastAccessedAt || memory.createdAt, now)
    : null;

  const relationshipConfidence = relatesTo.length
    ? scoreAiConfidence(relatesTo)
    : null;

  // Blend the two retrieval-time signals (0-1 each) into a single 0-100
  // confidence figure, then fold in relationship confidence (if this memory
  // has graph relationships to draw on) as a smaller, stabilizing factor.
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
    organizationRelevance:
      memory && organization
        ? {
            matches: String(memory.organization || "") === String(organization),
          }
        : null,
    retrievalMetadata: {
      type,
      retrievedAt: now.toISOString(),
    },
  };
}
