/**
 * importanceScoring.js
 *
 * Dynamic memory importance scoring engine (Issue #269).
 *
 * A "memory" here is a Decision or ActionItem extracted from a meeting and
 * stored in the knowledge graph (see knowledgeGraphService.js). Not every
 * memory is equally useful during retrieval, so each one is given an
 * importance score in [0, 100] computed from several weighted signals:
 *
 *   Importance Score =
 *       0.30 x Access Frequency
 *     + 0.25 x Recency
 *     + 0.20 x Graph Degree
 *     + 0.15 x AI Confidence
 *     + 0.10 x User Feedback
 *
 * Every individual factor is first normalized to a 0-100 scale so the
 * weights above can be applied consistently regardless of the underlying
 * unit (a count, a timestamp, a percentage, etc).
 *
 * The weighting strategy is intentionally kept in one place (WEIGHTS) and
 * each factor is computed by its own small, independently testable function
 * so new signals can be added later without touching retrieval call sites.
 */

// Weights must sum to 1. Exposed so services/tests can validate or tune them.
export const IMPORTANCE_WEIGHTS = Object.freeze({
  accessFrequency: 0.3,
  recency: 0.25,
  graphDegree: 0.2,
  aiConfidence: 0.15,
  userFeedback: 0.1,
});

// Tunable constants for normalization curves.
const ACCESS_FREQUENCY_SATURATION = 20; // accessCount at/above this -> 100
const GRAPH_DEGREE_SATURATION = 5; // relatesTo length at/above this -> 100
const RECENCY_HALF_LIFE_DAYS = 14; // score halves every N days since last touch
const DEFAULT_CONFIDENCE = 50; // neutral prior when no relationships exist yet
const DEFAULT_FEEDBACK = 50; // neutral prior when no feedback has been given

function clamp(value, min = 0, max = 100) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Access Frequency: how often this memory has been retrieved/opened.
 * Uses a simple linear ramp to a saturation point rather than raw counts,
 * so a handful of very frequently accessed memories don't dominate forever.
 */
export function scoreAccessFrequency(accessCount = 0) {
  const safeCount = Math.max(0, Number(accessCount) || 0);
  return clamp((safeCount / ACCESS_FREQUENCY_SATURATION) * 100);
}

/**
 * Recency: exponential decay based on days since the memory was last
 * accessed (falls back to creation time if never accessed). A memory
 * touched today scores ~100; one untouched for RECENCY_HALF_LIFE_DAYS
 * scores ~50, and so on.
 */
export function scoreRecency(referenceDate, now = new Date()) {
  if (!referenceDate) return 0;
  const ageMs = now.getTime() - new Date(referenceDate).getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  const decayed = 100 * Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
  return clamp(decayed);
}

/**
 * Graph Degree: how many other memories this one is linked to via
 * relatesTo. A more connected memory (part of a longer decision lineage,
 * or referenced by multiple action items) is generally more valuable.
 */
export function scoreGraphDegree(relatesTo = []) {
  const degree = Array.isArray(relatesTo) ? relatesTo.length : 0;
  return clamp((degree / GRAPH_DEGREE_SATURATION) * 100);
}

/**
 * AI Confidence: the average confidence (0-100, see relationshipScoring.js)
 * across this memory's relationships. Falls back to a neutral prior when
 * there are no relationships to draw confidence from yet.
 */
export function scoreAiConfidence(relatesTo = []) {
  if (!Array.isArray(relatesTo) || relatesTo.length === 0) {
    return DEFAULT_CONFIDENCE;
  }
  const total = relatesTo.reduce(
    (sum, r) => sum + (Number(r.confidence) || 0),
    0,
  );
  return clamp(total / relatesTo.length);
}

/**
 * User Feedback: average of explicit user ratings (1-5 stars) rescaled to
 * 0-100. Falls back to a neutral prior when no feedback has been recorded.
 */
export function scoreUserFeedback(feedbackScore = 0, feedbackCount = 0) {
  const count = Math.max(0, Number(feedbackCount) || 0);
  if (count === 0) return DEFAULT_FEEDBACK;
  const average = (Number(feedbackScore) || 0) / count; // expected range 1-5
  return clamp(((average - 1) / 4) * 100);
}

/**
 * Computes every normalized factor for a memory-like document without
 * combining them. Useful for exposing a breakdown through the API and for
 * unit testing individual signals.
 *
 * @param {Object} memory - A Decision or ActionItem document (or plain object)
 * @param {Date} [now] - Injection point for deterministic tests
 */
export function computeImportanceFactors(memory, now = new Date()) {
  const referenceDate = memory.lastAccessedAt || memory.createdAt;

  return {
    accessFrequency: scoreAccessFrequency(memory.accessCount),
    recency: scoreRecency(referenceDate, now),
    graphDegree: scoreGraphDegree(memory.relatesTo),
    aiConfidence: scoreAiConfidence(memory.relatesTo),
    userFeedback: scoreUserFeedback(memory.feedbackScore, memory.feedbackCount),
  };
}

/**
 * Combines the normalized factors into the final weighted importance score
 * (rounded integer, 0-100).
 */
export function combineImportanceFactors(factors) {
  const weighted =
    factors.accessFrequency * IMPORTANCE_WEIGHTS.accessFrequency +
    factors.recency * IMPORTANCE_WEIGHTS.recency +
    factors.graphDegree * IMPORTANCE_WEIGHTS.graphDegree +
    factors.aiConfidence * IMPORTANCE_WEIGHTS.aiConfidence +
    factors.userFeedback * IMPORTANCE_WEIGHTS.userFeedback;

  return Math.round(clamp(weighted));
}

/**
 * Computes the final importance score for a memory document.
 *
 * @param {Object} memory - A Decision or ActionItem document (or plain object)
 * @param {Date} [now] - Injection point for deterministic tests
 * @returns {{ score: number, factors: Object }}
 */
export function computeImportanceScore(memory, now = new Date()) {
  const factors = computeImportanceFactors(memory, now);
  const score = combineImportanceFactors(factors);
  return { score, factors };
}
