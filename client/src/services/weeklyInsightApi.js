import apiClient from "./apiClient.js";

export const getLatestInsight = async (orgId) => {
  const response = await apiClient.get(`/api/weekly-insights/${orgId}/latest`);
  return response.data;
};

export const getInsightHistory = async (orgId, page = 1, limit = 10) => {
  const response = await apiClient.get(`/api/weekly-insights/${orgId}`, {
    params: { page, limit },
  });
  return response.data;
};

export const triggerManualGeneration = async (orgId) => {
  const response = await apiClient.post(
    `/api/weekly-insights/${orgId}/generate`,
  );
  return response.data;
};

export const shareWeeklyInsight = async (orgId, insightId) => {
  const response = await apiClient.post(
    `/api/weekly-insights/${orgId}/insights/${insightId}/share`,
  );
  return response.data;
};

export const emailWeeklyInsight = async (orgId, insightId) => {
  const response = await apiClient.post(
    `/api/weekly-insights/${orgId}/insights/${insightId}/email`,
  );
  return response.data;
};
