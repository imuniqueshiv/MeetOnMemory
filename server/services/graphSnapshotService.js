// ==============================================
// services/graphSnapshotService.js
//
// Memory Graph Snapshot & Time-Travel engine (issue #374).
//
// Captures point-in-time copies of the organization-scoped knowledge graph
// (see graph/graphIndex.js) so users can browse history, compare any two
// points in time, and see how decisions/action items/relationships evolved.
//
// Storage strategy
// -----------------
// Each snapshot stores a slim, self-contained copy of the graph's nodes and
// edges (not a reference back to live documents, which would make old
// snapshots unstable as records are edited/deleted later). To avoid
// duplication when nothing has actually changed between two trigger events,
// every capture is content-hashed and compared against the organization's
// most recent snapshot; an identical hash means the capture is skipped
// rather than persisted. This keeps snapshot storage roughly proportional
// to *meaningful* graph changes rather than trigger frequency, without the
// added complexity of incremental/delta encoding.
//
// Diffing is computed on demand between any two stored snapshots (rather
// than precomputed/cached per-pair), which keeps writes cheap and avoids
// storage blowing up combinatorially — diffs are O(nodes + edges) and cheap
// enough to run per-request for graphs at this scale.
// ==============================================

import crypto from "crypto";
import GraphSnapshot from "../models/graphSnapshotModel.js";
import { buildGraph, NODE_TYPES } from "../graph/graphIndex.js";

/**
 * Converts the live in-memory graph (from buildGraph) into the flat
 * node/edge arrays persisted on a GraphSnapshot document.
 */
function serializeGraph({ adjacency, nodes }) {
  const serializedNodes = [];
  const counts = { decision: 0, actionItem: 0, meeting: 0 };

  const sortedNodeKeys = Array.from(nodes.keys()).sort();
  for (const key of sortedNodeKeys) {
    const node = nodes.get(key);
    if (!node) continue;
    counts[node.type] = (counts[node.type] || 0) + 1;

    serializedNodes.push({
      key,
      type: node.type,
      refId: node.id,
      text: node.text || "",
      owner: node.owner || "",
      status: node.status || "",
      sourceMeetingId: node.sourceMeetingId || null,
      createdAt: node.createdAt || null,
    });
  }

  // Adjacency is undirected and stored twice (once per direction) in the
  // live graph; collapse to one row per unordered pair for storage, using a
  // stable ordering so the same edge always serializes identically
  // regardless of which side buildGraph() happened to visit first.
  const edgeSet = new Map();
  for (const [fromKey, neighbors] of adjacency.entries()) {
    for (const { key: toKey, weight } of neighbors) {
      const [source, target] = [fromKey, toKey].sort();
      const edgeId = `${source}|${target}`;
      if (!edgeSet.has(edgeId)) {
        edgeSet.set(edgeId, { source, target, weight });
      }
    }
  }
  const serializedEdges = Array.from(edgeSet.values()).sort((a, b) =>
    `${a.source}|${a.target}`.localeCompare(`${b.source}|${b.target}`),
  );

  return {
    nodes: serializedNodes,
    edges: serializedEdges,
    metadata: {
      nodeCount: serializedNodes.length,
      edgeCount: serializedEdges.length,
      decisionCount: counts.decision || 0,
      actionItemCount: counts.actionItem || 0,
      meetingCount: counts.meeting || 0,
    },
  };
}

function hashGraph(nodes, edges) {
  // Nodes/edges are already deterministically sorted by serializeGraph, so
  // a straight JSON stringify is a stable representation to hash.
  const payload = JSON.stringify({
    nodes: nodes.map((n) => [
      n.key,
      n.text,
      n.owner,
      n.status,
      n.sourceMeetingId ? n.sourceMeetingId.toString() : null,
    ]),
    edges: edges.map((e) => [e.source, e.target, e.weight]),
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Captures the current state of an organization's knowledge graph.
 *
 * Skips persisting a new document if the content is identical to the
 * organization's latest snapshot (storage-efficiency requirement) unless
 * `force` is passed — e.g. for an explicit manual/debugging capture.
 *
 * @param {string|null} organization
 * @param {object} options
 * @param {"meeting_processed"|"manual"|"scheduled"|"consolidation"} options.trigger
 * @param {string|null} [options.sourceMeetingId]
 * @param {string|null} [options.triggeredBy] - user id, for manual triggers
 * @param {boolean} [options.force=false]
 * @returns {Promise<{snapshot: object|null, skipped: boolean, reason?: string}>}
 */
export async function captureSnapshot(organization, options = {}) {
  const {
    trigger,
    sourceMeetingId = null,
    triggeredBy = null,
    force = false,
  } = options;

  if (!trigger) {
    throw new Error("captureSnapshot requires a trigger");
  }

  const graph = await buildGraph(organization || null);
  const { nodes, edges, metadata } = serializeGraph(graph);
  const contentHash = hashGraph(nodes, edges);

  if (!force) {
    const latest = await GraphSnapshot.findOne({
      organization: organization || null,
    })
      .sort({ createdAt: -1 })
      .select("contentHash")
      .lean();

    if (latest && latest.contentHash === contentHash) {
      return { snapshot: null, skipped: true, reason: "no_graph_change" };
    }
  }

  const snapshot = await GraphSnapshot.create({
    organization: organization || null,
    trigger,
    sourceMeetingId,
    triggeredBy,
    contentHash,
    nodes,
    edges,
    metadata,
  });

  return { snapshot, skipped: false };
}

/**
 * Lists snapshots for an organization, newest first, with metadata only
 * (no node/edge payload) so the timeline view stays cheap to load.
 */
export async function listSnapshots(organization, { limit = 50, before } = {}) {
  const query = { organization: organization || null };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  return GraphSnapshot.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .select("-nodes -edges")
    .populate("sourceMeetingId", "title date")
    .populate("triggeredBy", "name email")
    .lean();
}

/**
 * Fetches a single full snapshot (nodes + edges included) for rendering or
 * export, scoped to the caller's organization.
 */
export async function getSnapshotById(id, organization) {
  return GraphSnapshot.findOne({
    _id: id,
    organization: organization || null,
  })
    .populate("sourceMeetingId", "title date")
    .populate("triggeredBy", "name email")
    .lean();
}

/**
 * Computes the difference between two snapshots belonging to the same
 * organization: nodes/edges added, removed, or modified (status/owner/text
 * changes on a node that exists in both).
 *
 * The two snapshots don't need to be adjacent in time — comparing any two
 * points lets users trace evolution across arbitrary ranges, per the issue.
 */
export async function diffSnapshots(fromId, toId, organization) {
  const [from, to] = await Promise.all([
    GraphSnapshot.findOne({
      _id: fromId,
      organization: organization || null,
    }).lean(),
    GraphSnapshot.findOne({
      _id: toId,
      organization: organization || null,
    }).lean(),
  ]);

  if (!from || !to) {
    throw new Error("One or both snapshots were not found");
  }

  const fromNodes = new Map(from.nodes.map((n) => [n.key, n]));
  const toNodes = new Map(to.nodes.map((n) => [n.key, n]));

  const addedNodes = [];
  const removedNodes = [];
  const modifiedNodes = [];

  for (const [key, node] of toNodes.entries()) {
    if (!fromNodes.has(key)) {
      addedNodes.push(node);
    }
  }
  for (const [key, node] of fromNodes.entries()) {
    if (!toNodes.has(key)) {
      removedNodes.push(node);
    }
  }
  for (const [key, toNode] of toNodes.entries()) {
    const fromNode = fromNodes.get(key);
    if (!fromNode) continue;

    const changedFields = ["text", "owner", "status"].filter(
      (field) => (fromNode[field] || "") !== (toNode[field] || ""),
    );
    if (changedFields.length) {
      modifiedNodes.push({
        key,
        before: fromNode,
        after: toNode,
        changedFields,
      });
    }
  }

  const edgeId = (e) => `${e.source}|${e.target}`;
  const fromEdges = new Map(from.edges.map((e) => [edgeId(e), e]));
  const toEdges = new Map(to.edges.map((e) => [edgeId(e), e]));

  const addedEdges = [];
  const removedEdges = [];
  const modifiedEdges = [];

  for (const [id, edge] of toEdges.entries()) {
    if (!fromEdges.has(id)) addedEdges.push(edge);
  }
  for (const [id, edge] of fromEdges.entries()) {
    if (!toEdges.has(id)) removedEdges.push(edge);
  }
  for (const [id, toEdge] of toEdges.entries()) {
    const fromEdge = fromEdges.get(id);
    if (fromEdge && fromEdge.weight !== toEdge.weight) {
      modifiedEdges.push({
        source: toEdge.source,
        target: toEdge.target,
        before: fromEdge.weight,
        after: toEdge.weight,
      });
    }
  }

  return {
    from: {
      id: from._id,
      createdAt: from.createdAt,
      trigger: from.trigger,
    },
    to: {
      id: to._id,
      createdAt: to.createdAt,
      trigger: to.trigger,
    },
    nodes: {
      added: addedNodes,
      removed: removedNodes,
      modified: modifiedNodes,
    },
    edges: {
      added: addedEdges,
      removed: removedEdges,
      modified: modifiedEdges,
    },
    summary: {
      nodesAdded: addedNodes.length,
      nodesRemoved: removedNodes.length,
      nodesModified: modifiedNodes.length,
      edgesAdded: addedEdges.length,
      edgesRemoved: removedEdges.length,
      edgesModified: modifiedEdges.length,
    },
  };
}

export const __internal = { serializeGraph, hashGraph };
export { NODE_TYPES };
