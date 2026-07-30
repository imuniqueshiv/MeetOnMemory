import apiClient from "./apiClient";

export const getDecisionGraph = async () => {
  const response = await apiClient.get("/api/decision-graph");
  return response.data;
};

export const getDecisionNeighbors = async (id) => {
  const response = await apiClient.get(`/api/decision-graph/${id}/neighbors`);
  return response.data;
};
