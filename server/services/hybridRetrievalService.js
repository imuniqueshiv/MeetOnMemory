// ==============================================
// hybridRetrievalService.js
// Implements FEATURE #266: Semantic Memory Retrieval with Hybrid Search.
//
// Pipeline:
//   1. Semantic vector search across meetings (Pinecone), decisions and
//      action items (in-memory cosine similarity over stored embeddings).
//   2. Knowledge-graph expansion: multi-hop traversal starting from the
//      semantic hits, following relatesTo edges and shared-meeting edges
//      (see server/graph/graphIndex.js).
//   3. Hybrid result fusion: semantic and graph scores are combined with
//      configurable weights into a single ranked list.
//
// This intentionally does not replace the existing `/api/search` (meeting
// only) endpoint - it's additive, exposed via `/api/search/hybrid`, so
// existing consumers keep working unchanged.
// ==============================================

import Meeting from "../models/meetingModel.js";
import { embedText, searchVectorStore } from "../utils/embeddingUtils.js";
import { cosineSimilarity } from "../utils/similarity.js";
import { buildExplanation } from "../utils/explanationBuilder.js";
import { recordMemoryAccessBatch } from "./importanceScoringService.js";
import {
  buildGraph,
  expandFromSeeds,
  nodeKey,
  NODE_TYPES,
} from "../graph/graphIndex.js";

export const DEFAULT_OPTIONS = Object.freeze({
  topK: 10,
  semanticTopK: 15,
  semanticWeight: 0.7,
  graphWeight: 0.3,
  maxHops: 2,
  decay: 0.6,
  minEdgeWeight: 0,
  includeTypes: ["meeting", "decision", "actionItem"],
});

function clamp01(n, fallback) {
  const num = Number(n);
  if (Number.isNaN(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

/**
 * Normalizes and validates user-supplied hybrid search options, filling in
 * safe defaults. Exported so the controller can reuse the same validation
 * for request parsing.
 */
export function resolveOptions(rawOptions = {}) {
  const topK = Math.max(
    1,
    Math.min(50, parseInt(rawOptions.topK, 10) || DEFAULT_OPTIONS.topK),
  );
  const semanticTopK = Math.max(
    topK,
    Math.min(
      100,
      parseInt(rawOptions.semanticTopK, 10) || DEFAULT_OPTIONS.semanticTopK,
    ),
  );
  const parsedMaxHops = parseInt(rawOptions.maxHops, 10);
  const maxHops = Math.max(
    0,
    Math.min(
      4,
      !Number.isNaN(parsedMaxHops) ? parsedMaxHops : DEFAULT_OPTIONS.maxHops,
    ),
  );
  const decay =
    clamp01(rawOptions.decay, DEFAULT_OPTIONS.decay) || DEFAULT_OPTIONS.decay;
  const minEdgeWeight = Math.max(
    0,
    Math.min(
      100,
      Number(rawOptions.minEdgeWeight) || DEFAULT_OPTIONS.minEdgeWeight,
    ),
  );

  let semanticWeight =
    typeof rawOptions.semanticWeight === "number" &&
    rawOptions.semanticWeight >= 0
      ? rawOptions.semanticWeight
      : DEFAULT_OPTIONS.semanticWeight;
  let graphWeight =
    typeof rawOptions.graphWeight === "number" && rawOptions.graphWeight >= 0
      ? rawOptions.graphWeight
      : DEFAULT_OPTIONS.graphWeight;

  // Normalize so the two weights always sum to 1 - keeps the fused score
  // interpretable (0-1) regardless of what the caller passed in, while still
  // letting them express *relative* emphasis (e.g. semanticWeight: 2,
  // graphWeight: 1 behaves the same as 0.7/0.3 wouldn't, but 0.66/0.33 would).
  const weightSum = semanticWeight + graphWeight;
  if (weightSum <= 0) {
    semanticWeight = DEFAULT_OPTIONS.semanticWeight;
    graphWeight = DEFAULT_OPTIONS.graphWeight;
  } else {
    semanticWeight = semanticWeight / weightSum;
    graphWeight = graphWeight / weightSum;
  }

  const includeTypes =
    Array.isArray(rawOptions.includeTypes) && rawOptions.includeTypes.length
      ? rawOptions.includeTypes.filter((t) =>
          DEFAULT_OPTIONS.includeTypes.includes(t),
        )
      : DEFAULT_OPTIONS.includeTypes;

  return {
    topK,
    semanticTopK,
    semanticWeight,
    graphWeight,
    maxHops,
    decay,
    minEdgeWeight,
    includeTypes: includeTypes.length
      ? includeTypes
      : DEFAULT_OPTIONS.includeTypes,
  };
}

/**
 * Semantic search over meetings (via Pinecone) plus decisions/action items
 * (via cosine similarity over embeddings already loaded into `graph`).
 * Reuses the graph's decision/action-item fetch instead of querying twice.
 */
async function runSemanticSearch(query, organization, graph, options) {
  const results = [];

  if (options.includeTypes.includes("meeting")) {
    try {
      // Note: Pinecone metadata does not currently store an organization
      // field (see embeddingUtils.indexMeeting), so an organization filter
      // here would silently zero out every result. Matching the existing
      // `/api/search` behavior, meeting hits are not org-filtered at the
      // vector-store layer.
      const meetingHits = await searchVectorStore(query, {
        limit: options.semanticTopK,
      });
      for (const hit of meetingHits) {
        results.push({
          key: nodeKey(NODE_TYPES.MEETING, hit.meetingId),
          type: NODE_TYPES.MEETING,
          id: hit.meetingId,
          title: hit.title,
          summary: hit.summary,
          semanticScore: hit.similarityScore || 0,
        });
      }
    } catch (err) {
      // Vector store may be unavailable in some environments (missing
      // Pinecone credentials, etc). Degrade gracefully to graph-only
      // results rather than failing the whole request.
      console.warn(
        "⚠️ Hybrid search: meeting vector search unavailable:",
        err.message,
      );
    }
  }

  const wantsDecisions = options.includeTypes.includes("decision");
  const wantsActionItems = options.includeTypes.includes("actionItem");

  if (wantsDecisions || wantsActionItems) {
    const queryEmbedding = await embedText(query);

    for (const [key, node] of graph.nodes.entries()) {
      if (node.type === NODE_TYPES.DECISION && !wantsDecisions) continue;
      if (node.type === NODE_TYPES.ACTION_ITEM && !wantsActionItems) continue;
      if (
        node.type !== NODE_TYPES.DECISION &&
        node.type !== NODE_TYPES.ACTION_ITEM
      )
        continue;
      if (!node.embedding?.length) continue;

      const score = cosineSimilarity(queryEmbedding, node.embedding);
      if (score <= 0) continue;

      results.push({
        key,
        type: node.type,
        id: node.id,
        title: node.text,
        summary: node.text,
        semanticScore: score,
      });
    }
  }

  results.sort((a, b) => b.semanticScore - a.semanticScore);
  const topResults = results.slice(0, options.semanticTopK);
  // 1-based rank within the semantic-only ordering, captured before graph
  // fusion potentially reorders things - this is what "vector search
  // ranking" means in the explanation layer (see explanationBuilder.js).
  topResults.forEach((r, index) => {
    r.semanticRank = index + 1;
  });
  return topResults;
}

/**
 * Fuses semantic hits with graph-expansion hits into a single ranked list.
 * A node found by both channels gets both scores combined; a node found by
 * only one channel is scored with the other channel implicitly at 0.
 */
export function fuseResults(semanticResults, graphExpansions, options) {
  const fused = new Map();

  for (const hit of semanticResults) {
    fused.set(hit.key, {
      key: hit.key,
      type: hit.type,
      id: hit.id,
      title: hit.title,
      summary: hit.summary,
      semanticScore: hit.semanticScore,
      semanticRank: hit.semanticRank ?? null,
      graphScore: 0,
      hops: 0,
      connectedVia: null,
    });
  }

  for (const hit of graphExpansions) {
    const node = hit.node || {};
    const existing = fused.get(hit.key);

    if (existing) {
      existing.graphScore = Math.max(existing.graphScore, hit.graphScore);
      existing.hops = hit.hops;
      existing.connectedVia = hit.path;
    } else {
      fused.set(hit.key, {
        key: hit.key,
        type: node.type,
        id: node.id,
        title: node.text || node.id,
        summary: node.text || null,
        semanticScore: 0,
        semanticRank: null,
        graphScore: hit.graphScore,
        hops: hit.hops,
        connectedVia: hit.path,
      });
    }
  }

  const ranked = Array.from(fused.values()).map((entry) => ({
    ...entry,
    finalScore:
      options.semanticWeight * entry.semanticScore +
      options.graphWeight * entry.graphScore,
  }));

  ranked.sort((a, b) => b.finalScore - a.finalScore);
  return ranked;
}

/**
 * Attaches lightweight source-meeting context (title/date) to decision and
 * action-item results so the client doesn't need a second round trip for
 * the common case of "what meeting did this come from".
 */
async function enrichWithMeetingContext(rankedResults, graph) {
  const meetingIds = new Set();

  for (const result of rankedResults) {
    if (result.type === NODE_TYPES.MEETING) {
      meetingIds.add(result.id);
      continue;
    }
    const node = graph.nodes.get(result.key);
    if (node?.sourceMeetingId) meetingIds.add(node.sourceMeetingId);
  }

  if (!meetingIds.size) return rankedResults;

  const meetings = await Meeting.find({ _id: { $in: Array.from(meetingIds) } })
    .select("title createdAt")
    .lean();
  const meetingById = new Map(meetings.map((m) => [m._id.toString(), m]));

  return rankedResults.map((result) => {
    if (result.type === NODE_TYPES.MEETING) {
      const meeting = meetingById.get(result.id);
      return meeting
        ? {
            ...result,
            title: result.title || meeting.title,
            createdAt: meeting.createdAt,
          }
        : result;
    }

    const node = graph.nodes.get(result.key);
    const meeting = node?.sourceMeetingId
      ? meetingById.get(node.sourceMeetingId)
      : null;
    return meeting
      ? {
          ...result,
          sourceMeeting: {
            id: meeting._id.toString(),
            title: meeting.title,
            createdAt: meeting.createdAt,
          },
        }
      : result;
  });
}

/**
 * Attaches a human-readable "why was this returned?" explanation to each
 * result (FEATURE #270), built from data already loaded onto the graph
 * nodes - no extra DB queries needed. Also fires a fire-and-forget access
 * recording for any decision/action-item results, so future recency-based
 * explanations (and the existing importance-scoring feature) stay accurate.
 */
function attachExplanations(rankedResults, graph, organization) {
  const decisionIds = [];
  const actionItemIds = [];

  const explained = rankedResults.map((result, index) => {
    const node =
      result.type === NODE_TYPES.MEETING ? null : graph.nodes.get(result.key);

    if (result.type === NODE_TYPES.DECISION) decisionIds.push(result.id);
    if (result.type === NODE_TYPES.ACTION_ITEM) actionItemIds.push(result.id);

    const explanation = buildExplanation({
      type: result.type,
      semanticScore: result.semanticScore || 0,
      graphScore: result.graphScore || 0,
      hops: result.hops || 0,
      vectorRank: result.semanticRank ?? null,
      memory: node,
      organization,
    });

    return { ...result, rank: index + 1, explanation };
  });

  // Fire-and-forget: never let access tracking slow down or break a search
  // response. Reuses the same recording path the importance-scoring
  // feature (#269) already relies on, so the two stay consistent.
  if (decisionIds.length) {
    recordMemoryAccessBatch("decision", decisionIds).catch(() => {});
  }
  if (actionItemIds.length) {
    recordMemoryAccessBatch("actionItem", actionItemIds).catch(() => {});
  }

  return explained;
}

/**
 * Main entry point: hybrid retrieval combining semantic vector search with
 * knowledge-graph multi-hop expansion.
 *
 * @param {string} query
 * @param {string|null} organization
 * @param {object} rawOptions - see DEFAULT_OPTIONS / resolveOptions
 */
export async function hybridRetrieve(query, organization, rawOptions = {}) {
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("A non-empty query string is required");
  }

  const options = resolveOptions(rawOptions);

  // Build the graph once - also carries decision/action-item embeddings so
  // semantic search doesn't need a second DB round trip.
  const graph = await buildGraph(organization);

  const semanticResults = await runSemanticSearch(
    query,
    organization,
    graph,
    options,
  );

  const seedKeys = semanticResults
    .filter((r) => graph.adjacency.has(r.key))
    .map((r) => r.key);

  const graphExpansions =
    options.maxHops > 0
      ? expandFromSeeds(graph, seedKeys, {
          maxHops: options.maxHops,
          decay: options.decay,
          minEdgeWeight: options.minEdgeWeight,
        })
      : [];

  const fused = fuseResults(semanticResults, graphExpansions, options);
  const topResults = fused.slice(0, options.topK);
  const enriched = await enrichWithMeetingContext(topResults, graph);
  const explained = attachExplanations(enriched, graph, organization);

  return {
    results: explained,
    meta: {
      query,
      options,
      semanticHitCount: semanticResults.length,
      graphExpansionCount: graphExpansions.length,
      fusedCount: fused.length,
    },
  };
}
