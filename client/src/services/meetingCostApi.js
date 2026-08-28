import apiClient from "./apiClient.js";

export const getCostConfig = async () => {
  const response = await apiClient.get("/api/meeting-cost/config");
  return response.data;
};

export const updateCostConfig = async (configData) => {
  const response = await apiClient.put("/api/meeting-cost/config", configData);
  return response.data;
};

export const getMeetingCostDetails = async (meetingId) => {
  const response = await apiClient.get(
    `/api/meeting-cost/meeting/${meetingId}`,
  );
  return response.data;
};

export const getOrgCostAnalytics = async (params) => {
  const response = await apiClient.get("/api/meeting-cost/analytics/org", {
    params,
  });
  return response.data;
};

export const getMemberTimeStats = async (params) => {
  const response = await apiClient.get("/api/meeting-cost/analytics/members", {
    params,
  });
  return response.data;
};

export const exportCostReport = async (params) => {
  const response = await apiClient.get("/api/meeting-cost/analytics/export", {
    params,
    responseType: "blob", // Important for downloading files
  });
  return response.data;
};

export const getEnterpriseCostResourceEngine = async (timeframe = "30d") => {
  const response = await apiClient.get(
    `/api/meeting-cost/enterprise-engine?timeframe=${timeframe}`,
  );
  return response.data;
};
