import apiClient from "./apiClient.js";

export const semanticKnowledgeGraphApi = {
  extractSemanticGraph: (meetingId) =>
    apiClient.get(`/api/semantic-knowledge-graph/meeting/${meetingId}`),

  getSemanticNeighborhood: (seedNodeId, kHops = 1) =>
    apiClient.get(`/api/semantic-knowledge-graph/neighborhood`, {
      params: { seedNodeId, kHops },
    }),
};

export default semanticKnowledgeGraphApi;
