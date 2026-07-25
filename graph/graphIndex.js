// ==============================================
// graph/graphIndex.js
// Builds an in-memory, organization-scoped knowledge graph out of
// Decisions, Action Items and the Meetings they came from, and provides
// a multi-hop traversal (graph expansion) used by the hybrid retrieval
// pipeline (see server/services/hybridRetrievalService.js).
//
// Nodes:
//   - decision:<id>
//   - actionItem:<id>
//   - meeting:<id>
//
// Edges (all undirected for traversal purposes, weight 0-100):
//   - decision <-> decision      via Decision.relatesTo[].confidence
//   - actionItem <-> actionItem  via ActionItem.relatesTo[].confidence
//   - decision/actionItem <-> meeting  via sourceMeetingId (fixed weight,
//     since "belongs to the same meeting" is a hard fact, not a similarity
//     estimate)
//
// The graph is rebuilt per request rather than cached globally, since
// membership is organization-scoped and relatively small (decisions +
// action items for a workspace, not the whole database).
// ==============================================

import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";

// Weight assigned to "belongs to the same meeting" edges. Not a similarity
// score, but a strong structural signal, so it's deliberately high but
// beneath a perfect explicit-match (100) to keep semantic-derived edges
// distinguishable in ranking/debugging.
const MEETING_EDGE_WEIGHT = 60;

export const NODE_TYPES = Object.freeze({
  DECISION: "decision",
  ACTION_ITEM: "actionItem",
  MEETING: "meeting",
});

export function nodeKey(type, id) {
  return `${type}:${id.toString()}`;
}

/**
 * Loads all decisions and action items for an organization and assembles
 * an adjacency-list graph plus a lookup of node metadata.
 *
 * @param {string|null} organization
 * @returns {Promise<{adjacency: Map<string, Array<{key:string, weight:number}>>, nodes: Map<string, object>}>}
 */
export async function buildGraph(organization) {
  const orgFilter = { organization: organization || null };

  const [decisions, actionItems] = await Promise.all([
    Decision.find(orgFilter).select(
      "text owner status sourceMeetingId relatesTo createdAt embedding organization accessCount lastAccessedAt feedbackScore feedbackCount",
    ),
    ActionItem.find(orgFilter).select(
      "text owner status sourceMeetingId relatesTo createdAt embedding organization accessCount lastAccessedAt feedbackScore feedbackCount",
    ),
  ]);

  const adjacency = new Map();
  const nodes = new Map();

  const addNode = (key, data) => {
    if (!nodes.has(key)) nodes.set(key, data);
    if (!adjacency.has(key)) adjacency.set(key, []);
  };
   
  const ensureAdjacency = (key) => {
    if (!adjacency.has(key)) {
      adjacency.set(key, []);
    }
  };

  const addEdge = (keyA, keyB, weight) => {
    if (keyA === keyB) return;
    addNode(keyA, nodes.get(keyA));
    addNode(keyB, nodes.get(keyB));
    adjacency.get(keyA).push({ key: keyB, weight });
    adjacency.get(keyB).push({ key: keyA, weight });
  };

  for (const decision of decisions) {
    const key = nodeKey(NODE_TYPES.DECISION, decision._id);
    addNode(key, {
      type: NODE_TYPES.DECISION,
      id: decision._id.toString(),
      text: decision.text,
      owner: decision.owner,
      status: decision.status,
      sourceMeetingId: decision.sourceMeetingId?.toString() || null,
      createdAt: decision.createdAt,
      embedding: decision.embedding,
      organization: decision.organization?.toString() || null,
      relatesTo: decision.relatesTo || [],
      accessCount: decision.accessCount || 0,
      lastAccessedAt: decision.lastAccessedAt || null,
      feedbackScore: decision.feedbackScore || 0,
      feedbackCount: decision.feedbackCount || 0,
    });

    if (decision.sourceMeetingId) {
      const meetingKey = nodeKey(NODE_TYPES.MEETING, decision.sourceMeetingId);
      addNode(meetingKey, {
        type: NODE_TYPES.MEETING,
        id: decision.sourceMeetingId.toString(),
      });
      addEdge(key, meetingKey, MEETING_EDGE_WEIGHT);
    }

    for (const rel of decision.relatesTo || []) {
      const targetKey = nodeKey(NODE_TYPES.DECISION, rel.target);
      addEdge(key, targetKey, rel.confidence ?? 0);
    }
  }

  for (const item of actionItems) {
    const key = nodeKey(NODE_TYPES.ACTION_ITEM, item._id);
    addNode(key, {
      type: NODE_TYPES.ACTION_ITEM,
      id: item._id.toString(),
      text: item.text,
      owner: item.owner,
      status: item.status,
      sourceMeetingId: item.sourceMeetingId?.toString() || null,
      createdAt: item.createdAt,
      embedding: item.embedding,
      organization: item.organization?.toString() || null,
      relatesTo: item.relatesTo || [],
      accessCount: item.accessCount || 0,
      lastAccessedAt: item.lastAccessedAt || null,
      feedbackScore: item.feedbackScore || 0,
      feedbackCount: item.feedbackCount || 0,
    });

    if (item.sourceMeetingId) {
      const meetingKey = nodeKey(NODE_TYPES.MEETING, item.sourceMeetingId);
      addNode(meetingKey, {
        type: NODE_TYPES.MEETING,
        id: item.sourceMeetingId.toString(),
      });
      addEdge(key, meetingKey, MEETING_EDGE_WEIGHT);
    }

    for (const rel of item.relatesTo || []) {
      const targetKey = nodeKey(NODE_TYPES.ACTION_ITEM, rel.target);
      addEdge(key, targetKey, rel.confidence ?? 0);
    }
  }

  return { adjacency, nodes };
}

/**
 * Multi-hop breadth-first expansion from a set of seed node keys.
 *
 * Each hop's contribution decays multiplicatively so that a node reached
 * through several weak links scores lower than one reached directly with
 * high confidence. A node reached via multiple paths keeps its best
 * (highest-scoring) path.
 *
 * @param {{adjacency: Map, nodes: Map}} graph
 * @param {string[]} seedKeys - node keys already surfaced by semantic search
 * @param {object} options
 * @param {number} [options.maxHops=2] - how many relationship hops to traverse
 * @param {number} [options.decay=0.6] - multiplicative decay applied per hop
 * @param {number} [options.minEdgeWeight=0] - ignore edges weaker than this (0-100)
 * @returns {Array<{key:string, node:object, hops:number, graphScore:number, path:string[]}>}
 *   Excludes the seed nodes themselves - only newly-discovered connected nodes.
 */
export function expandFromSeeds(graph, seedKeys, options = {}) {
  const { maxHops = 2, decay = 0.6, minEdgeWeight = 0 } = options;
  const { adjacency, nodes } = graph;

  const seedSet = new Set(seedKeys);
  // best score found so far for each discovered (non-seed) node
  const best = new Map();

  // BFS frontier: each entry carries the accumulated score reaching it
  let frontier = seedKeys
    .filter((k) => adjacency.has(k))
    .map((k) => ({ key: k, score: 1, path: [k] }));

  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop++) {
    const nextFrontier = [];

    for (const { key, score, path } of frontier) {
      const neighbors = adjacency.get(key) || [];

      for (const { key: neighborKey, weight } of neighbors) {
        if (weight < minEdgeWeight) continue;
        if (seedSet.has(neighborKey)) continue; // don't re-surface a seed as a "discovery"
        if (path.includes(neighborKey)) continue; // avoid cycles within a single path

        const edgeStrength = Math.max(0, Math.min(100, weight)) / 100;
        const candidateScore = score * edgeStrength * decay;

        const existing = best.get(neighborKey);
        if (!existing || candidateScore > existing.graphScore) {
          const record = {
            key: neighborKey,
            node: nodes.get(neighborKey),
            hops: hop,
            graphScore: candidateScore,
            path: [...path, neighborKey],
          };
          best.set(neighborKey, record);
          nextFrontier.push({
            key: neighborKey,
            score: candidateScore,
            path: [...path, neighborKey],
          });
        }
      }
    }

    frontier = nextFrontier;
  }

  return Array.from(best.values()).sort((a, b) => b.graphScore - a.graphScore);
}