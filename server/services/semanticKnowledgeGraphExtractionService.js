/**
 * Service providing semantic entity-relation extraction from meeting memories,
 * directional relationship tagging, and k-hop graph expansion.
 */
class SemanticKnowledgeGraphExtractionService {
  /**
   * Extract semantic entities and directional relationships from transcript and notes
   */
  extractSemanticRelationships(meeting) {
    const nodes = [];
    const edges = [];
    const meetingId = meeting._id?.toString() || "meeting-root";
    const title = meeting.title || "Meeting";

    nodes.push({
      id: `meeting-${meetingId}`,
      label: title,
      type: "MEETING",
      data: { scheduledStartTime: meeting.scheduledStartTime },
    });

    // Extract Decisions
    const decisions = meeting.decisions || [];
    decisions.forEach((decision, idx) => {
      const decisionId = `decision-${meetingId}-${idx}`;
      nodes.push({
        id: decisionId,
        label: typeof decision === "string" ? decision : decision.text,
        type: "DECISION",
      });
      edges.push({
        source: decisionId,
        target: `meeting-${meetingId}`,
        relation: "DECIDED_IN",
        confidence: 0.95,
      });
    });

    // Extract Action Items & Assignees
    const actionItems = meeting.actionItems || [];
    actionItems.forEach((item, idx) => {
      const actionId = `action-${meetingId}-${idx}`;
      nodes.push({
        id: actionId,
        label: item.title || item.task || `Action Item ${idx + 1}`,
        type: "ACTION_ITEM",
        status: item.status,
      });
      edges.push({
        source: actionId,
        target: `meeting-${meetingId}`,
        relation: "DERIVED_FROM",
        confidence: 0.9,
      });

      if (item.assignee) {
        const userId = item.assignee._id || item.assignee;
        const userName = item.assignee.name || "Assignee";
        const personId = `person-${userId}`;
        if (!nodes.some((n) => n.id === personId)) {
          nodes.push({
            id: personId,
            label: userName,
            type: "PERSON",
          });
        }
        edges.push({
          source: actionId,
          target: personId,
          relation: "OWNED_BY",
          confidence: 1.0,
        });
      }
    });

    // Extract Topics & Tags
    const tags = meeting.tags || [];
    tags.forEach((tag, _idx) => {
      const topicId = `topic-${encodeURIComponent(tag)}`;
      if (!nodes.some((n) => n.id === topicId)) {
        nodes.push({
          id: topicId,
          label: tag,
          type: "TOPIC",
        });
      }
      edges.push({
        source: `meeting-${meetingId}`,
        target: topicId,
        relation: "DISCUSSED_TOPIC",
        confidence: 0.85,
      });
    });

    return { nodes, edges };
  }

  /**
   * Perform k-hop neighborhood expansion from a seed entity
   */
  expandNeighborhood(allNodes, allEdges, seedNodeId, kHops = 1) {
    const visitedNodes = new Set([seedNodeId]);
    const includedEdges = new Set();
    let currentFrontier = new Set([seedNodeId]);

    for (let hop = 0; hop < kHops; hop++) {
      const nextFrontier = new Set();

      for (const edge of allEdges) {
        if (
          currentFrontier.has(edge.source) ||
          currentFrontier.has(edge.target)
        ) {
          includedEdges.add(edge);
          if (!visitedNodes.has(edge.source)) {
            visitedNodes.add(edge.source);
            nextFrontier.add(edge.source);
          }
          if (!visitedNodes.has(edge.target)) {
            visitedNodes.add(edge.target);
            nextFrontier.add(edge.target);
          }
        }
      }

      currentFrontier = nextFrontier;
      if (currentFrontier.size === 0) break;
    }

    const filteredNodes = allNodes.filter((n) => visitedNodes.has(n.id));
    return {
      nodes: filteredNodes,
      edges: Array.from(includedEdges),
    };
  }
}

export default new SemanticKnowledgeGraphExtractionService();
