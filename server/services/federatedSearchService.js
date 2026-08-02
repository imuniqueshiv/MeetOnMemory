import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import Meeting from "../models/meetingModel.js";
import { embedText, searchVectorStore } from "../utils/embeddingUtils.js";
import { cosineSimilarity } from "../utils/similarity.js";
import { buildExplanation } from "../utils/explanationBuilder.js";
import { recordMemoryAccessBatch } from "./importanceScoringService.js";
import {
  buildMultiOrgGraph,
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

function fuseResults(semanticResults, graphExpansions, options, orgMap = {}) {
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
      workspace: hit.workspace || null,
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
      const orgId = node.organization || null;
      const ws =
        orgId && orgMap[orgId]
          ? { id: orgId, name: orgMap[orgId].name, slug: orgMap[orgId].slug }
          : orgId
            ? { id: orgId }
            : null;
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
        workspace: ws,
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

async function runFederatedSemanticSearch(
  query,
  accessibleOrgIds,
  orgMap,
  graph,
  options,
) {
  const results = [];

  if (options.includeTypes.includes("meeting")) {
    try {
      const meetingHits = await searchVectorStore(query, {
        limit: options.semanticTopK,
      });
      for (const hit of meetingHits) {
        const hitOrg = hit.organization || null;
        if (
          accessibleOrgIds.length &&
          hitOrg &&
          !accessibleOrgIds.includes(hitOrg)
        ) {
          continue;
        }
        results.push({
          key: nodeKey(NODE_TYPES.MEETING, hit.meetingId),
          type: NODE_TYPES.MEETING,
          id: hit.meetingId,
          title: hit.title,
          summary: hit.summary,
          semanticScore: hit.similarityScore || 0,
          workspace:
            hitOrg && orgMap[hitOrg]
              ? {
                  id: hitOrg,
                  name: orgMap[hitOrg].name,
                  slug: orgMap[hitOrg].slug,
                }
              : hitOrg
                ? { id: hitOrg }
                : null,
        });
      }
    } catch (err) {
      console.warn(
        "Federated search: meeting vector search unavailable:",
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

      const nodeOrg = node.organization || null;
      results.push({
        key,
        type: node.type,
        id: node.id,
        title: node.text,
        summary: node.text,
        semanticScore: score,
        workspace:
          nodeOrg && orgMap[nodeOrg]
            ? {
                id: nodeOrg,
                name: orgMap[nodeOrg].name,
                slug: orgMap[nodeOrg].slug,
              }
            : nodeOrg
              ? { id: nodeOrg }
              : null,
      });
    }
  }

  results.sort((a, b) => b.semanticScore - a.semanticScore);
  const topResults = results.slice(0, options.semanticTopK);
  topResults.forEach((r, index) => {
    r.semanticRank = index + 1;
  });
  return topResults;
}

async function enrichFederatedResults(rankedResults, graph) {
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
    .select("title createdAt organization")
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

function attachFederatedExplanations(rankedResults, graph) {
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
      organization: node?.organization || null,
      workspace: result.workspace || null,
    });

    return { ...result, rank: index + 1, explanation };
  });

  if (decisionIds.length) {
    recordMemoryAccessBatch("decision", decisionIds).catch(() => {});
  }
  if (actionItemIds.length) {
    recordMemoryAccessBatch("actionItem", actionItemIds).catch(() => {});
  }

  return explained;
}

export async function federatedRetrieve(
  userId,
  organizationIds,
  rawOptions = {},
) {
  if (
    !rawOptions.query ||
    typeof rawOptions.query !== "string" ||
    !rawOptions.query.trim()
  ) {
    throw new Error("A non-empty query string is required");
  }

  const options = resolveOptions(rawOptions);
  const { query } = rawOptions;

  let accessibleOrgIds;
  if (organizationIds?.length) {
    const memberships = await Membership.find({
      user: userId,
      organization: { $in: organizationIds },
      status: "active",
    })
      .select("organization")
      .lean();
    accessibleOrgIds = [
      ...new Set(memberships.map((m) => m.organization.toString())),
    ];
  } else {
    const memberships = await Membership.find({
      user: userId,
      status: "active",
    })
      .select("organization")
      .lean();
    accessibleOrgIds = [
      ...new Set(memberships.map((m) => m.organization.toString())),
    ];
  }

  if (!accessibleOrgIds.length) {
    return {
      results: [],
      meta: {
        query,
        options,
        workspacesSearched: 0,
        workspaces: [],
        totalHits: 0,
      },
    };
  }

  const orgs = await Organization.find(
    { _id: { $in: accessibleOrgIds } },
    "name slug",
  ).lean();
  const orgMap = {};
  const workspaces = [];
  for (const org of orgs) {
    const id = org._id.toString();
    orgMap[id] = { name: org.name, slug: org.slug };
    workspaces.push({ id, name: org.name, slug: org.slug });
  }

  const graph = await buildMultiOrgGraph(accessibleOrgIds);

  const semanticResults = await runFederatedSemanticSearch(
    query,
    accessibleOrgIds,
    orgMap,
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

  const fused = fuseResults(semanticResults, graphExpansions, options, orgMap);
  const topResults = fused.slice(0, options.topK);

  const enriched = await enrichFederatedResults(topResults, graph);

  const explained = attachFederatedExplanations(enriched, graph);

  return {
    results: explained,
    meta: {
      query,
      options,
      workspacesSearched: workspaces.length,
      workspaces,
      semanticHitCount: semanticResults.length,
      graphExpansionCount: graphExpansions.length,
      fusedCount: fused.length,
    },
  };
}
