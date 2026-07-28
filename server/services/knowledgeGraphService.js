import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import { embedText } from "../utils/embeddingUtils.js";
import { calculateRelationshipConfidence } from "../utils/relationshipScoring.js";
import { applyImportanceScore } from "./importanceScoringService.js";
import { cosineSimilarity } from "../utils/similarity.js";

const SIMILARITY_THRESHOLD = 0.85;
const CONFIDENCE_THRESHOLD = 70; // conservative, per issue's technical considerations

function upsertRelationship(document, targetId, confidence) {
  const existing = document.relatesTo.find(
    (r) => r.target.toString() === targetId.toString(),
  );

  if (existing) {
    existing.confidence = confidence;
    existing.computedAt = new Date();
    return;
  }

  document.relatesTo.push({
    target: targetId,
    confidence,
    computedAt: new Date(),
  });
}

async function findBestMatch(Model, text, embedding, organization) {
  if (!embedding?.length) return null;

  // Scope candidates to the same organization (multi-tenant correctness)
  const candidates = await Model.find({
    organization: organization || null,
    embedding: { $exists: true, $ne: [] },
  }).limit(200); // cap for performance; fine at this scale

  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = cosineSimilarity(embedding, candidate.embedding);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (bestScore < SIMILARITY_THRESHOLD) {
    return null;
  }

  return {
    match: best,
    similarity: bestScore,
    confidence: calculateRelationshipConfidence({
      similarity: bestScore,
      createdAt: best.createdAt,
      explicitSignal:
        best.status === "resolved" || best.status === "superseded",
    }),
  };
}

/**
 * Called after a meeting's structuredMoM is generated/updated.
 * Extracts decisions/action_items, embeds them, links to prior related entries.
 */
export async function processStructuredMoM(meeting, mom) {
  const organization = meeting.organization || null;
  const results = { decisions: [], actionItems: [] };

  // --- Decisions ---
  for (const decisionText of mom.decisions || []) {
    const text =
      typeof decisionText === "string" ? decisionText : decisionText.text || "";
    if (!text.trim()) continue;

    const embedding = await embedText(text);
    const match = await findBestMatch(Decision, text, embedding, organization);
    const existingDecision = await Decision.findOne({
      text,
      sourceMeetingId: meeting._id,
    });

    if (existingDecision) {
      results.decisions.push(existingDecision);
      continue;
    }

    const decision = await Decision.create({
      text,
      sourceMeetingId: meeting._id,
      organization,
      embedding,
      relatesTo:
        match && match.confidence >= CONFIDENCE_THRESHOLD
          ? [
              {
                target: match.match._id,
                confidence: match.confidence,
                computedAt: new Date(),
              },
            ]
          : [],
    });

    if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
      upsertRelationship(match.match, decision._id, match.confidence);

      // The matched decision just gained a relationship, so its graph
      // degree (and therefore importance score) changed too.
      await applyImportanceScore(match.match);
    }

    await applyImportanceScore(decision);
    results.decisions.push(decision);
  }

  // --- Action Items ---
  for (const item of mom.action_items || []) {
    const text =
      typeof item === "string" ? item : item.task || item.action || "";
    if (!text.trim()) continue;

    const owner =
      typeof item === "object" ? item.owner || "Unassigned" : "Unassigned";
    let dueDate = null;
    if (typeof item === "object" && item.due_date) {
      const parsedDate = new Date(item.due_date);
      if (!isNaN(parsedDate.getTime())) {
        dueDate = parsedDate;
      }
    }

    const embedding = await embedText(text);
    const match = await findBestMatch(
      ActionItem,
      text,
      embedding,
      organization,
    );
    const existingActionItem = await ActionItem.findOne({
      text,
      sourceMeetingId: meeting._id,
    });

    if (existingActionItem) {
      results.actionItems.push(existingActionItem);
      continue;
    }

    const actionItem = await ActionItem.create({
      text,
      owner,
      dueDate,
      sourceMeetingId: meeting._id,
      organization,
      embedding,
      relatesTo:
        match && match.confidence >= CONFIDENCE_THRESHOLD
          ? [
              {
                target: match.match._id,
                confidence: match.confidence,
                computedAt: new Date(),
              },
            ]
          : [],
    });

    if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
      upsertRelationship(match.match, actionItem._id, match.confidence);

      // The matched action item just gained a relationship, so its
      // graph degree (and therefore importance score) changed too.
      await applyImportanceScore(match.match);
    }

    await applyImportanceScore(actionItem);
    results.actionItems.push(actionItem);
  }

  return results;
}

/**
 * Returns the chronological chain of decisions related to a given decision ID,
 * following relatesTo edges whose confidence clears CONFIDENCE_THRESHOLD.
 */
export async function getDecisionLineage(decisionId) {
  const visited = new Set();
  const chain = [];

  async function walk(id) {
    if (visited.has(id.toString())) return;
    visited.add(id.toString());

    const decision = await Decision.findById(id).populate(
      "sourceMeetingId",
      "title date",
    );
    if (!decision) return;
    chain.push(decision);

    const sortedRelations = [...decision.relatesTo]
      .filter((r) => r.confidence >= CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.confidence - a.confidence);

    for (const relation of sortedRelations) {
      await walk(relation.target);
    }
  }

  await walk(decisionId);
  chain.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return chain;
}

/**
 * Attempts to detect resolution mentions of open action items within a new meeting's transcript/summary.
 * Simple heuristic: reuses the AI-generated summary text to check for completion phrasing near
 * a semantically similar action item. Kept intentionally conservative (embedding match required)
 * to avoid false-positive auto-resolutions.
 */
export async function detectResolutions(meeting, mom) {
  const organization = meeting.organization || null;
  const openItems = await ActionItem.find({
    organization,
    status: { $in: ["open", "in-progress"] },
  });
  if (!openItems.length) return [];

  const resolvedNowIds = [];
  const summaryText =
    (mom.summary || "") + " " + (mom.key_discussions || []).join(" ");
  const completionPhrases = [
    "completed",
    "done",
    "resolved",
    "finished",
    "closed out",
    "wrapped up",
  ];

  const hasCompletionLanguage = completionPhrases.some((p) =>
    summaryText.toLowerCase().includes(p),
  );
  if (!hasCompletionLanguage) return [];

  const summaryEmbedding = await embedText(summaryText);

  for (const item of openItems) {
    const score = cosineSimilarity(summaryEmbedding, item.embedding);
    if (score >= SIMILARITY_THRESHOLD) {
      item.status = "resolved";
      item.resolvedAt = new Date();
      item.resolvedInMeetingId = meeting._id;
      item.accessCount = (item.accessCount || 0) + 1;
      item.lastAccessedAt = new Date();
      await applyImportanceScore(item);
      resolvedNowIds.push(item._id);
    }
  }

  return resolvedNowIds;
}
