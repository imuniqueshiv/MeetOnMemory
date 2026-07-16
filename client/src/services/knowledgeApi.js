import apiClient from "./apiClient";

export const knowledgeApi = {
  getActionItems: (status = "all", sortBy = "createdAt") =>
    apiClient.get(
      `/api/knowledge/action-items?status=${status}&sortBy=${sortBy}`,
    ),
  getDecisions: (sortBy = "createdAt", status) =>
    apiClient.get(
      `/api/knowledge/decisions?sortBy=${sortBy}${status ? `&status=${status}` : ""}`,
    ),
  getDecisionLineage: (decisionId) =>
    apiClient.get(`/api/knowledge/decisions/${decisionId}/lineage`),
  submitFeedback: (type, id, rating) =>
    apiClient.patch(`/api/knowledge/${type}/${id}/feedback`, { rating }),
  recalculateImportance: () =>
    apiClient.post(`/api/knowledge/importance/recalculate`),
};
