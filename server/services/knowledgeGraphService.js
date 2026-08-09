import Meeting from "../models/meetingModel.js";
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

/**
 * Knowledge Graph Service
 * Builds and analyzes knowledge graphs from meeting data to visualize
 * relationships between meetings, people, decisions, and topics
 */

/**
 * Build complete knowledge graph for an organization
 * @param {String} organizationId - Organization ID
 * @param {Object} filters - Optional filters (date range, entity types)
 * @returns {Object} Graph data with nodes and edges
 */
export const buildOrganizationGraph = async (organizationId, filters = {}) => {
  try {
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    // Fetch all meetings for organization
    const meetingQuery = { organization: organizationId };
    if (filters.startDate) {
      meetingQuery.date = { $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      meetingQuery.date = {
        ...meetingQuery.date,
        $lte: new Date(filters.endDate),
      };
    }

    const meetings = await Meeting.find(meetingQuery)
      .populate("uploadedBy", "name email")
      .populate("participants", "name email")
      .sort({ date: -1 })
      .limit(100);

    // Add meeting nodes
    meetings.forEach((meeting) => {
      const meetingNode = {
        id: `meeting-${meeting._id}`,
        type: "meeting",
        label: meeting.title,
        properties: {
          id: meeting._id.toString(),
          title: meeting.title,
          date: meeting.date,
          meetingType: meeting.meetingType,
          status: meeting.status,
          duration: meeting.duration,
          participantCount: meeting.participants?.length || 0,
        },
        position: { x: 0, y: 0 }, // Will be calculated by layout algorithm
      };
      nodes.push(meetingNode);
      nodeMap.set(meetingNode.id, meetingNode);
    });

    // Fetch decisions
    const decisions = await Decision.find({
      sourceMeetingId: { $in: meetings.map((m) => m._id) },
    }).limit(500);

    // Add decision nodes
    decisions.forEach((decision) => {
      const decisionNode = {
        id: `decision-${decision._id}`,
        type: "decision",
        label: decision.text.substring(0, 50),
        properties: {
          id: decision._id.toString(),
          text: decision.text,
          status: decision.status,
          owner: decision.owner,
          createdAt: decision.createdAt,
          importanceScore: decision.importanceScore || 0,
        },
        position: { x: 0, y: 0 },
      };
      nodes.push(decisionNode);
      nodeMap.set(decisionNode.id, decisionNode);

      // Add edge from meeting to decision
      edges.push({
        source: `meeting-${decision.sourceMeetingId}`,
        target: decisionNode.id,
        type: "produced",
        properties: {
          relationship: "meeting_produced_decision",
        },
        weight: 1,
      });
    });

    // Fetch action items
    const actionItems = await ActionItem.find({
      sourceMeetingId: { $in: meetings.map((m) => m._id) },
    }).limit(500);

    // Add action item nodes
    actionItems.forEach((item) => {
      const itemNode = {
        id: `action-${item._id}`,
        type: "action-item",
        label: item.text.substring(0, 50),
        properties: {
          id: item._id.toString(),
          text: item.text,
          owner: item.owner,
          status: item.status,
          dueDate: item.dueDate,
          lifecycleState: item.lifecycleState,
        },
        position: { x: 0, y: 0 },
      };
      nodes.push(itemNode);
      nodeMap.set(itemNode.id, itemNode);

      // Add edge from meeting to action item
      edges.push({
        source: `meeting-${item.sourceMeetingId}`,
        target: itemNode.id,
        type: "assigned",
        properties: {
          relationship: "meeting_assigned_action",
        },
        weight: 1,
      });
    });

    // Add person nodes and relationships
    const personMap = new Map();
    meetings.forEach((meeting) => {
      // Add uploader
      if (meeting.uploadedBy) {
        const personId = `person-${meeting.uploadedBy._id}`;
        if (!personMap.has(personId)) {
          personMap.set(personId, {
            id: personId,
            type: "person",
            label: meeting.uploadedBy.name,
            properties: {
              id: meeting.uploadedBy._id.toString(),
              name: meeting.uploadedBy.name,
              email: meeting.uploadedBy.email,
              meetingCount: 0,
            },
            position: { x: 0, y: 0 },
          });
        }
        personMap.get(personId).properties.meetingCount++;

        // Add edge from person to meeting (created)
        edges.push({
          source: personId,
          target: `meeting-${meeting._id}`,
          type: "created",
          properties: {
            relationship: "person_created_meeting",
          },
          weight: 2,
        });
      }

      // Add participants
      if (meeting.participants) {
        meeting.participants.forEach((participant) => {
          const personId = `person-${participant._id}`;
          if (!personMap.has(personId)) {
            personMap.set(personId, {
              id: personId,
              type: "person",
              label: participant.name,
              properties: {
                id: participant._id.toString(),
                name: participant.name,
                email: participant.email,
                meetingCount: 0,
              },
              position: { x: 0, y: 0 },
            });
          }
          personMap.get(personId).properties.meetingCount++;

          // Add edge from person to meeting (participated)
          edges.push({
            source: personId,
            target: `meeting-${meeting._id}`,
            type: "participated",
            properties: {
              relationship: "person_participated_meeting",
            },
            weight: 1,
          });
        });
      }
    });

    // Add all person nodes
    personMap.forEach((person) => nodes.push(person));

    // Extract topics from meeting titles and descriptions
    const topicMap = new Map();
    meetings.forEach((meeting) => {
      const topics = extractTopics(
        meeting.title + " " + (meeting.description || ""),
      );
      topics.forEach((topic) => {
        const topicId = `topic-${topic.toLowerCase().replace(/\s+/g, "-")}`;
        if (!topicMap.has(topicId)) {
          topicMap.set(topicId, {
            id: topicId,
            type: "topic",
            label: topic,
            properties: {
              name: topic,
              meetingCount: 0,
            },
            position: { x: 0, y: 0 },
          });
        }
        topicMap.get(topicId).properties.meetingCount++;

        // Add edge from meeting to topic
        edges.push({
          source: `meeting-${meeting._id}`,
          target: topicId,
          type: "discussed",
          properties: {
            relationship: "meeting_discussed_topic",
          },
          weight: 1,
        });
      });
    });

    // Add all topic nodes
    topicMap.forEach((topic) => nodes.push(topic));

    // Add decision relationships (if decisions relate to each other)
    decisions.forEach((decision) => {
      if (decision.relatesTo && decision.relatesTo.length > 0) {
        decision.relatesTo.forEach((relation) => {
          // FIX: Changed relation.targetId to relation.target to match schema
          if (relation.target && nodeMap.has(`decision-${relation.target}`)) {
            edges.push({
              source: `decision-${decision._id}`,
              target: `decision-${relation.target}`,
              type: "relates-to",
              properties: {
                relationship: "decision_relates_to",
                relationType: relation.type || "related",
              },
              weight: 1,
            });
          }
        });
      }
    });

    // Calculate graph metrics
    const metrics = calculateGraphMetrics(nodes, edges);

    return {
      nodes,
      edges,
      metadata: {
        organization: organizationId,
        generatedAt: new Date(),
        nodeCount: nodes.length,
        edgeCount: edges.length,
        filters,
        metrics,
      },
    };
  } catch (error) {
    console.error("Error building organization graph:", error);
    throw error;
  }
};

/**
 * Extract topics from text using simple keyword extraction
 * @param {String} text - Text to extract topics from
 * @returns {Array} Array of topic strings
 */
const extractTopics = (text) => {
  if (!text) return [];

  // Simple topic extraction - split by common delimiters and filter
  const words = text
    .toLowerCase()
    .split(/[\s,;:]+/)
    .filter((word) => word.length > 3)
    .filter(
      (word) =>
        !["the", "and", "for", "with", "this", "that", "from"].includes(word),
    );

  // Count word frequency
  const wordFreq = {};
  words.forEach((word) => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Return top 5 most frequent words as topics
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
};

/**
 * Calculate graph metrics (centrality, density, etc.)
 * @param {Array} nodes - Graph nodes
 * @param {Array} edges - Graph edges
 * @returns {Object} Metrics object
 */
const calculateGraphMetrics = (nodes, edges) => {
  const metrics = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    density: 0,
    averageDegree: 0,
    connectedComponents: 0,
    topInfluencers: [],
  };

  if (nodes.length === 0) return metrics;

  // Calculate degree for each node
  const degreeMap = new Map();
  nodes.forEach((node) => degreeMap.set(node.id, 0));

  edges.forEach((edge) => {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
  });

  // Calculate average degree
  const totalDegree = Array.from(degreeMap.values()).reduce(
    (sum, d) => sum + d,
    0,
  );
  metrics.averageDegree = totalDegree / nodes.length;

  // Calculate density (actual edges / possible edges)
  const maxEdges = (nodes.length * (nodes.length - 1)) / 2;
  metrics.density = maxEdges > 0 ? edges.length / maxEdges : 0;

  // Find top influencers (highest degree nodes)
  const sortedByDegree = Array.from(degreeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  metrics.topInfluencers = sortedByDegree.map(([nodeId, degree]) => {
    const node = nodes.find((n) => n.id === nodeId);
    return {
      nodeId,
      type: node?.type,
      label: node?.label,
      degree,
    };
  });

  // Calculate connected components (simplified)
  metrics.connectedComponents = estimateConnectedComponents(nodes, edges);

  return metrics;
};

/**
 * Estimate number of connected components using BFS
 * @param {Array} nodes - Graph nodes
 * @param {Array} edges - Graph edges
 * @returns {Number} Estimated component count
 */
const estimateConnectedComponents = (nodes, edges) => {
  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, []));

  edges.forEach((edge) => {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  });

  const visited = new Set();
  let components = 0;

  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      components++;
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = adjacency.get(current) || [];
        neighbors.forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    }
  });

  return components;
};

/**
 * Build graph for a specific meeting
 * @param {String} meetingId - Meeting ID
 * @returns {Object} Meeting-specific subgraph
 */
export const buildMeetingGraph = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId)
      .populate("uploadedBy", "name email")
      .populate("participants", "name email");

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const nodes = [];
    const edges = [];

    // Add meeting node
    const meetingNode = {
      id: `meeting-${meeting._id}`,
      type: "meeting",
      label: meeting.title,
      properties: {
        id: meeting._id.toString(),
        title: meeting.title,
        date: meeting.date,
        meetingType: meeting.meetingType,
        status: meeting.status,
      },
      position: { x: 0, y: 0 },
    };
    nodes.push(meetingNode);

    // Add decisions
    const decisions = await Decision.find({ sourceMeetingId: meetingId });
    decisions.forEach((decision) => {
      const decisionNode = {
        id: `decision-${decision._id}`,
        type: "decision",
        label: decision.text.substring(0, 50),
        properties: {
          id: decision._id.toString(),
          text: decision.text,
          status: decision.status,
        },
        position: { x: 0, y: 0 },
      };
      nodes.push(decisionNode);
      edges.push({
        source: meetingNode.id,
        target: decisionNode.id,
        type: "produced",
        properties: {},
        weight: 1,
      });
    });

    // Add action items
    const actionItems = await ActionItem.find({ sourceMeetingId: meetingId });
    actionItems.forEach((item) => {
      const itemNode = {
        id: `action-${item._id}`,
        type: "action-item",
        label: item.text.substring(0, 50),
        properties: {
          id: item._id.toString(),
          text: item.text,
          status: item.status,
        },
        position: { x: 0, y: 0 },
      };
      nodes.push(itemNode);
      edges.push({
        source: meetingNode.id,
        target: itemNode.id,
        type: "assigned",
        properties: {},
        weight: 1,
      });
    });

    // Add participants
    if (meeting.participants) {
      meeting.participants.forEach((participant) => {
        const personNode = {
          id: `person-${participant._id}`,
          type: "person",
          label: participant.name,
          properties: {
            id: participant._id.toString(),
            name: participant.name,
          },
          position: { x: 0, y: 0 },
        };
        nodes.push(personNode);
        edges.push({
          source: personNode.id,
          target: meetingNode.id,
          type: "participated",
          properties: {},
          weight: 1,
        });
      });
    }

    return {
      nodes,
      edges,
      metadata: {
        meeting: meetingId,
        generatedAt: new Date(),
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
  } catch (error) {
    console.error("Error building meeting graph:", error);
    throw error;
  }
};

/**
 * Find path between two entities in the graph
 * @param {String} orgId - Organization ID
 * @param {String} startNodeId - Start node ID
 * @param {String} endNodeId - End node ID
 * @returns {Object} Path data
 */
export const findPath = async (orgId, startNodeId, endNodeId) => {
  try {
    const graph = await buildOrganizationGraph(orgId);
    const { nodes, edges } = graph;

    // Build adjacency list
    const adjacency = new Map();
    nodes.forEach((node) => adjacency.set(node.id, []));

    edges.forEach((edge) => {
      adjacency.get(edge.source)?.push({ target: edge.target, edge });
      adjacency.get(edge.target)?.push({ target: edge.source, edge });
    });

    // BFS to find shortest path
    const queue = [{ nodeId: startNodeId, path: [startNodeId] }];
    const visited = new Set([startNodeId]);

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift();

      if (nodeId === endNodeId) {
        // Path found - extract nodes and edges
        const pathNodes = path.map((id) => nodes.find((n) => n.id === id));
        const pathEdges = [];

        for (let i = 0; i < path.length - 1; i++) {
          const edge = edges.find(
            (e) =>
              (e.source === path[i] && e.target === path[i + 1]) ||
              (e.target === path[i] && e.source === path[i + 1]),
          );
          if (edge) pathEdges.push(edge);
        }

        return {
          path: path,
          nodes: pathNodes,
          edges: pathEdges,
          length: path.length - 1,
        };
      }

      const neighbors = adjacency.get(nodeId) || [];
      neighbors.forEach(({ target }) => {
        if (!visited.has(target)) {
          visited.add(target);
          queue.push({ nodeId: target, path: [...path, target] });
        }
      });
    }

    return {
      path: [],
      nodes: [],
      edges: [],
      length: -1,
      message: "No path found",
    };
  } catch (error) {
    console.error("Error finding path:", error);
    throw error;
  }
};

/**
 * Get graph analytics for organization
 * @param {String} orgId - Organization ID
 * @returns {Object} Analytics data
 */
export const getGraphAnalytics = async (orgId) => {
  try {
    const graph = await buildOrganizationGraph(orgId);
    const { nodes, edges, metadata } = graph;

    // Count by type
    const nodeCounts = {};
    nodes.forEach((node) => {
      nodeCounts[node.type] = (nodeCounts[node.type] || 0) + 1;
    });

    const edgeCounts = {};
    edges.forEach((edge) => {
      edgeCounts[edge.type] = (edgeCounts[edge.type] || 0) + 1;
    });

    return {
      nodeCounts,
      edgeCounts,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      density: metadata.metrics.density,
      averageDegree: metadata.metrics.averageDegree,
      connectedComponents: metadata.metrics.connectedComponents,
      topInfluencers: metadata.metrics.topInfluencers,
    };
  } catch (error) {
    console.error("Error getting graph analytics:", error);
    throw error;
  }
};

/**
 * Search entities in the graph
 * @param {String} orgId - Organization ID
 * @param {String} query - Search query
 * @param {String} type - Optional entity type filter
 * @returns {Array} Matching entities
 */
export const searchEntities = async (orgId, query, type = null) => {
  try {
    const graph = await buildOrganizationGraph(orgId);
    const { nodes } = graph;

    const lowerQuery = query.toLowerCase();

    let filtered = nodes.filter((node) => {
      const matchesQuery =
        node.label.toLowerCase().includes(lowerQuery) ||
        Object.values(node.properties).some((val) =>
          String(val).toLowerCase().includes(lowerQuery),
        );

      const matchesType = !type || node.type === type;

      return matchesQuery && matchesType;
    });

    return filtered.slice(0, 50); // Limit results
  } catch (error) {
    console.error("Error searching entities:", error);
    throw error;
  }
};

export default {
  processStructuredMoM,
  getDecisionLineage,
  detectResolutions,
  buildOrganizationGraph,
  buildMeetingGraph,
  findPath,
  getGraphAnalytics,
  searchEntities,
};
