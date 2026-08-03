import apiClient from "./apiClient";

export const getDecisionGraph = async (params = {}) => {
  const response = await apiClient.get("/api/decision-graph", { params });
  return response.data;
};

export const getDecisionNeighbors = async (id) => {
  const response = await apiClient.get(`/api/decision-graph/${id}/neighbors`);
  return response.data;
};
