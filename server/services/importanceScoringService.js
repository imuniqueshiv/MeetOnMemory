/**
 * importanceScoringService.js
 *
 * Applies the pure scoring logic in utils/importanceScoring.js to actual
 * Decision / ActionItem documents: persisting scores, tracking access, and
 * recording user feedback so the score stays up to date as usage evolves.
 */

import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import { computeImportanceScore } from "../utils/importanceScoring.js";

const MODELS = {
  decision: Decision,
  actionItem: ActionItem,
};

function resolveModel(type) {
  const Model = MODELS[type];
  if (!Model) {
    throw new Error(`Unknown memory type: ${type}`);
  }
  return Model;
}

/**
 * Recomputes and persists the importance score for a single already-loaded
 * document (does not re-fetch from the DB). Returns the updated document.
 */
export async function applyImportanceScore(document, now = new Date()) {
  const { score, factors } = computeImportanceScore(document, now);
  document.importanceScore = score;
  document.importanceFactors = factors;
  document.importanceUpdatedAt = now;
  await document.save();
  return document;
}

/**
 * Recomputes and persists the importance score for a memory by id.
 */
export async function recalculateImportanceById(type, id) {
  const Model = resolveModel(type);
  const document = await Model.findById(id);
  if (!document) return null;
  return applyImportanceScore(document);
}

/**
 * Batch recalculates importance scores for every memory of the given type
 * (optionally scoped to an organization). Used by the maintenance endpoint
 * and can also be run as a scheduled job.
 *
 * Runs in small batches so it stays reasonable on large collections while
 * remaining simple (no external job queue dependency).
 */
export async function recalculateAllImportanceScores({
  organization = undefined,
  batchSize = 200,
} = {}) {
  const filter = organization === undefined ? {} : { organization };
  const results = { decisions: 0, actionItems: 0 };

  for (const [key, Model] of Object.entries(MODELS)) {
    let skip = 0;
    while (true) {
      const batch = await Model.find(filter).skip(skip).limit(batchSize);
      if (batch.length === 0) break;

      const now = new Date();
      await Promise.all(batch.map((doc) => applyImportanceScore(doc, now)));

      if (key === "decision") results.decisions += batch.length;
      else results.actionItems += batch.length;

      if (batch.length < batchSize) break;
      skip += batchSize;
    }
  }

  return results;
}

/**
 * Records that a memory was retrieved/opened by a user: bumps the access
 * counter, updates lastAccessedAt, and recalculates its importance score.
 * Fails silently (logs only) so access tracking never breaks a read path.
 */
export async function recordMemoryAccess(type, id) {
  try {
    const Model = resolveModel(type);
    const document = await Model.findById(id);
    if (!document) return null;

    document.accessCount = (document.accessCount || 0) + 1;
    document.lastAccessedAt = new Date();

    return await applyImportanceScore(document);
  } catch (error) {
    console.error(`recordMemoryAccess error (${type}:${id}):`, error);
    return null;
  }
}

/**
 * Records a batch of accesses (e.g. every item in a list response) without
 * awaiting each one sequentially. Intended to be fire-and-forget from the
 * controller so it never slows down the response.
 */
export function recordMemoryAccessBatch(type, ids = []) {
  return Promise.all(ids.map((id) => recordMemoryAccess(type, id))).catch(
    (error) => {
      console.error(`recordMemoryAccessBatch error (${type}):`, error);
    },
  );
}

/**
 * Records explicit user feedback (1-5 rating) on a memory and recalculates
 * its importance score to reflect the new average.
 */
export async function recordMemoryFeedback(type, id, rating) {
  const numericRating = Number(rating);
  if (
    !Number.isFinite(numericRating) ||
    numericRating < 1 ||
    numericRating > 5
  ) {
    throw new Error("Feedback rating must be a number between 1 and 5");
  }

  const Model = resolveModel(type);
  const document = await Model.findById(id);
  if (!document) return null;

  document.feedbackScore = (document.feedbackScore || 0) + numericRating;
  document.feedbackCount = (document.feedbackCount || 0) + 1;

  return applyImportanceScore(document);
}

export default {
  applyImportanceScore,
  recalculateImportanceById,
  recalculateAllImportanceScores,
  recordMemoryAccess,
  recordMemoryAccessBatch,
  recordMemoryFeedback,
};
