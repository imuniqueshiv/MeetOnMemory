import apiClient from "./apiClient";

/**
 * Semantic knowledge graph explorer API (Issue #2446).
 *
 * Backs `SemanticGraphExplorer`. The server mounts these routes at
 * `/api/semantic-graph` and scopes both to the caller's organization.
 */

const emptyGraph = () => ({ nodes: [], edges: [] });

const toGraph = (payload) => ({
  nodes: Array.isArray(payload?.nodes) ? payload.nodes : [],
  edges: Array.isArray(payload?.edges) ? payload.edges : [],
});

/**
 * Extract the entity-relation graph for a single meeting.
 *
 * @param {string} meetingId
 * @returns {Promise<{nodes: Array<object>, edges: Array<object>}>}
 */
export const extractMeetingSemanticGraph = async (meetingId) => {
  if (!meetingId) return emptyGraph();

  const { data } = await apiClient.get(
    `/api/semantic-graph/meeting/${meetingId}`,
  );
  return toGraph(data?.graph);
};

/**
 * Expand the k-hop neighborhood of an entity across the organization's meetings.
 *
 * @param {string} seedNodeId - Entity id to expand from, e.g. `person-<id>`
 * @param {number} [kHops=1]
 * @returns {Promise<{nodes: Array<object>, edges: Array<object>}>}
 */
export const getSemanticNeighborhood = async (seedNodeId, kHops = 1) => {
  if (!seedNodeId) return emptyGraph();

  const { data } = await apiClient.get("/api/semantic-graph/neighborhood", {
    params: { seedNodeId, kHops },
  });
  return toGraph(data);
};

export default {
  extractMeetingSemanticGraph,
  getSemanticNeighborhood,
};
