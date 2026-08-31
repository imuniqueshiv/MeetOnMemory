import apiClient from "./apiClient";

export const getDecisionLog = async (options = {}) => {
  const { page = 1, limit = 20, outcome, sortBy, sortOrder } = options;
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (outcome) params.append("outcome", outcome);
  if (sortBy) params.append("sortBy", sortBy);
  if (sortOrder) params.append("sortOrder", sortOrder);

  const response = await apiClient.get(
    `/api/decision-log?${params.toString()}`,
  );
  return response.data;
};

export const getDecisionTimeline = async () => {
  const response = await apiClient.get("/api/decision-log/timeline");
  return response.data;
};

export const getOverdueReviews = async () => {
  const response = await apiClient.get("/api/decision-log/overdue");
  return response.data;
};

export const createDecisionLogEntry = async (data) => {
  const response = await apiClient.post("/api/decision-log", data);
  return response.data;
};

export const updateDecisionOutcome = async (id, data) => {
  const response = await apiClient.put(`/api/decision-log/${id}/outcome`, data);
  return response.data;
};

export const linkActionItemsToDecision = async (id, actionItemIds) => {
  const response = await apiClient.put(
    `/api/decision-log/${id}/link-action-items`,
    {
      actionItemIds,
    },
  );
  return response.data;
};

export const updateDecisionLogEntry = async (id, data) => {
  const response = await apiClient.put(`/api/decision-log/${id}`, data);
  return response.data;
};

export const deleteDecisionLogEntry = async (id) => {
  const response = await apiClient.delete(`/api/decision-log/${id}`);
  return response.data;
};

export const exportDecisionLog = async (format = "json") => {
  const response = await apiClient.get(`/api/decision-log/export`, {
    params: { format },
    responseType: format === "csv" ? "blob" : "json",
  });
  return response.data;
};
