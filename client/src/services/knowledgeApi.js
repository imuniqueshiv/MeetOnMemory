import apiClient from "./apiClient";

export const knowledgeApi = {
  getActionItems: (status = "all", sortBy = "createdAt", options = {}) => {
    let url = `/api/knowledge/action-items?status=${status}&sortBy=${sortBy}`;
    if (options.includeArchived) url += `&includeArchived=true`;
    if (options.lifecycleState)
      url += `&lifecycleState=${options.lifecycleState}`;
    if (options.search) url += `&search=${encodeURIComponent(options.search)}`;
    if (options.page) url += `&page=${options.page}`;
    if (options.limit) url += `&limit=${options.limit}`;
    if (options.owner) url += `&owner=${encodeURIComponent(options.owner)}`;
    if (options.priority)
      url += `&priority=${encodeURIComponent(options.priority)}`;
    if (options.organization)
      url += `&organization=${encodeURIComponent(options.organization)}`;
    if (options.sortOrder)
      url += `&sortOrder=${encodeURIComponent(options.sortOrder)}`;
    return apiClient.get(url);
  },
  updateActionItemStatus: (id, status) =>
    apiClient.patch(`/api/knowledge/action-items/${id}`, { status }),
  toggleActionItemReminder: (id, enabled) =>
    apiClient.patch(`/api/knowledge/action-items/${id}/reminders`, { enabled }),
  getDecisions: (sortBy = "createdAt", status, options = {}) => {
    let url = `/api/knowledge/decisions?sortBy=${sortBy}${status ? `&status=${status}` : ""}`;
    if (options.includeArchived) url += `&includeArchived=true`;
    if (options.lifecycleState)
      url += `&lifecycleState=${options.lifecycleState}`;
    if (options.search) url += `&search=${encodeURIComponent(options.search)}`;
    if (options.page) url += `&page=${options.page}`;
    if (options.limit) url += `&limit=${options.limit}`;
    return apiClient.get(url);
  },
  /**
   * Unified archived decisions + action items with correct combined pagination (#901).
   */
  getArchivedMemories: (options = {}) => {
    const params = new URLSearchParams();
    if (options.type) params.append("type", options.type);
    if (options.search) params.append("search", options.search);
    if (options.page) params.append("page", String(options.page));
    if (options.limit) params.append("limit", String(options.limit));
    const query = params.toString();
    return apiClient.get(`/api/knowledge/archive${query ? `?${query}` : ""}`);
  },
  getDecisionLineage: (decisionId) =>
    apiClient.get(`/api/knowledge/decisions/${decisionId}/lineage`),
  submitFeedback: (type, id, rating) =>
    apiClient.patch(`/api/knowledge/${type}/${id}/feedback`, { rating }),
  recalculateImportance: () =>
    apiClient.post(`/api/knowledge/importance/recalculate`),
  // Memory Lifecycle Management (#377, #716)
  runLifecycleSweep: () => apiClient.post(`/api/knowledge/lifecycle/run`),
  updateMemoryLifecycleState: (type, id, state, reason) =>
    apiClient.patch(`/api/knowledge/${type}/${id}/lifecycle`, {
      state,
      reason,
    }),
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
  getGraphSnapshots: ({ limit = 20, before, page } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.append("limit", limit);
    if (before) params.append("before", before);
    if (page) params.append("page", page);
    return apiClient.get(`/api/knowledge/graph/snapshots?${params.toString()}`);
  },

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
  // AI-Powered Contradiction Detection & Conflict Resolution (#375, #715)
  scanForConflicts: ({
    dryRun = false,
    models,
    useAI = true,
    minConfidence,
  } = {}) =>
    apiClient.post(`/api/knowledge/conflicts/scan`, {
      dryRun,
      ...(models ? { models } : {}),
      useAI,
      ...(minConfidence !== undefined ? { minConfidence } : {}),
    }),
  getConflicts: ({ model, status = "open", limit = 50 } = {}) =>
    apiClient.get(
      `/api/knowledge/conflicts?status=${status}&limit=${limit}${model ? `&model=${model}` : ""}`,
    ),
  getConflictDetail: (conflictId) =>
    apiClient.get(`/api/knowledge/conflicts/${conflictId}`),
  resolveConflict: (
    conflictId,
    { resolutionType, keptMemoryId, customValue, note },
  ) =>
    apiClient.post(`/api/knowledge/conflicts/${conflictId}/resolve`, {
      resolutionType,
      ...(keptMemoryId ? { keptMemoryId } : {}),
      ...(customValue ? { customValue } : {}),
      ...(note ? { note } : {}),
    }),
};
