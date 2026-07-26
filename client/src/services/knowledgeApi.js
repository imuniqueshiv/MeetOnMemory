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
  // Memory Consolidation Engine
  runConsolidation: ({ dryRun = true, models } = {}) =>
    apiClient.post(`/api/knowledge/consolidate`, {
      dryRun,
      ...(models ? { models } : {}),
    }),
  getConsolidationHistory: (model = "decision", limit = 50) =>
    apiClient.get(
      `/api/knowledge/consolidation/history?model=${model}&limit=${limit}`,
    ),
  // Memory Graph Snapshot & Time-Travel
  getGraphSnapshots: ({ limit = 50, before } = {}) =>
    apiClient.get(
      `/api/knowledge/graph/snapshots?limit=${limit}${before ? `&before=${before}` : ""}`,
    ),
  getGraphSnapshot: (id) =>
    apiClient.get(`/api/knowledge/graph/snapshots/${id}`),
  exportGraphSnapshot: (id) =>
    apiClient.get(`/api/knowledge/graph/snapshots/${id}/export`),
  diffGraphSnapshots: (fromId, toId) =>
    apiClient.get(
      `/api/knowledge/graph/snapshots/diff?from=${fromId}&to=${toId}`,
    ),
  createGraphSnapshot: (force = false) =>
    apiClient.post(`/api/knowledge/graph/snapshots`, { force }),
};
