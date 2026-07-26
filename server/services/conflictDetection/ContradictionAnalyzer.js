// ==============================================
// 📘 ContradictionAnalyzer.js
// Pairwise contradiction analysis for the AI-Powered Contradiction
// Detection engine (Issue #375).
//
// Two memories are worth flagging when they're clearly about the same
// topic (shared vocabulary / high embedding similarity) but assert
// different values (differing dates, owners, numbers, or an explicit
// negation) — as opposed to Memory Consolidation, which looks for near-
// identical paraphrases of the *same* value.
//
// Design mirrors ConsolidationAIProcessor.js: pure, synchronous helpers
// wherever possible (areMemoriesSimilar's contradiction-detection
// counterpart), with the network-dependent AI refinement isolated to a
// single async function so the pipeline is fully testable offline.
// ==============================================

import { cosineSimilarity } from "../../utils/similarity.js";
import {
  heuristicContradictionCheck,
  sharesTopicVocabulary,
} from "../../utils/contradictionSignals.js";
import { classifyContradiction } from "../GenerativeAIService.js";

// Below this, two memories aren't considered "about the same topic" at
// all, regardless of wording overlap.
export const DEFAULT_TOPIC_EMBEDDING_THRESHOLD = 0.55;

// At/above this, Memory Consolidation's duplicate detector already owns
// the pair (same fact, reworded) — contradiction detection intentionally
// stays out of its way rather than double-flagging the same records.
export const DEFAULT_DUPLICATE_EMBEDDING_CEILING = 0.9;

// Minimum confidence (0-100) for a pairwise result to be surfaced as a
// conflict at all.
export const DEFAULT_MIN_CONFIDENCE = 55;

/**
 * Cheap, synchronous pre-filter: are these two records plausibly about
 * the same topic, using whichever signal is available (embeddings first,
 * lexical overlap as a fallback for records with no/mismatched
 * embeddings)?
 */
export function isSameTopic(
  recordA,
  recordB,
  {
    topicEmbeddingThreshold = DEFAULT_TOPIC_EMBEDDING_THRESHOLD,
    duplicateEmbeddingCeiling = DEFAULT_DUPLICATE_EMBEDDING_CEILING,
  } = {},
) {
  const hasEmbeddings =
    recordA.embedding?.length &&
    recordB.embedding?.length &&
    recordA.embedding.length === recordB.embedding.length;

  if (hasEmbeddings) {
    const score = cosineSimilarity(recordA.embedding, recordB.embedding);
    // Near-duplicate wording is Consolidation's job, not ours — but we
    // still fall through to the lexical check, since two contradictory
    // sentences that differ only by one date/number can *also* sit above
    // the duplicate ceiling on embeddings alone.
    if (score >= topicEmbeddingThreshold && score < duplicateEmbeddingCeiling) {
      return true;
    }
  }

  return sharesTopicVocabulary(recordA.text, recordB.text);
}

/**
 * Full pairwise contradiction analysis. Synchronous by default (heuristic
 * only); pass `{ useAI: true }` to additionally consult the LLM-based
 * classifier for a confidence/explanation refinement. AI failures or a
 * missing API key silently fall back to the heuristic result, so this
 * never throws for configuration reasons.
 */
export async function detectContradiction(
  recordA,
  recordB,
  {
    useAI = true,
    minConfidence = DEFAULT_MIN_CONFIDENCE,
    topicEmbeddingThreshold = DEFAULT_TOPIC_EMBEDDING_THRESHOLD,
    duplicateEmbeddingCeiling = DEFAULT_DUPLICATE_EMBEDDING_CEILING,
    classifyFn = classifyContradiction,
  } = {},
) {
  if (
    !isSameTopic(recordA, recordB, {
      topicEmbeddingThreshold,
      duplicateEmbeddingCeiling,
    })
  ) {
    return {
      isContradiction: false,
      confidence: 0,
      signals: [],
      explanation: "",
      source: "heuristic",
    };
  }

  const heuristic = heuristicContradictionCheck(recordA.text, recordB.text);

  if (!useAI) {
    return {
      isContradiction:
        heuristic.isContradiction && heuristic.confidence >= minConfidence,
      confidence: heuristic.confidence,
      signals: heuristic.signals,
      explanation: heuristic.explanation,
      source: "heuristic",
    };
  }

  let aiResult = null;
  try {
    aiResult = await classifyFn(recordA.text, recordB.text);
  } catch (err) {
    // Defensive: classifyFn already catches internally, but a bad mock in
    // tests or an unexpected throw shouldn't crash the whole scan.
    console.error("Contradiction AI classification threw:", err.message);
  }

  if (!aiResult) {
    return {
      isContradiction:
        heuristic.isContradiction && heuristic.confidence >= minConfidence,
      confidence: heuristic.confidence,
      signals: heuristic.signals,
      explanation: heuristic.explanation,
      source: "heuristic",
    };
  }

  if (aiResult.relation === "entailment") {
    // The AI is confident these are the same fact reworded, not a
    // conflict — defer to Consolidation rather than raising a false
    // conflict, even if the heuristic thought otherwise.
    return {
      isContradiction: false,
      confidence: 0,
      signals: heuristic.signals,
      explanation: "AI classified this pair as paraphrases, not a conflict.",
      source: "ai",
    };
  }

  const isContradiction =
    aiResult.relation === "contradiction" &&
    aiResult.confidence >= minConfidence;

  return {
    isContradiction,
    // Blend so a heuristic that found zero signals can't be fully
    // overridden by a noisy AI call, and vice versa — both must broadly
    // agree for high confidence.
    confidence: isContradiction
      ? Math.round(
          (aiResult.confidence + Math.max(heuristic.confidence, 40)) / 2,
        )
      : aiResult.confidence,
    signals: heuristic.signals,
    explanation: aiResult.explanation || heuristic.explanation,
    source: "ai",
  };
}
