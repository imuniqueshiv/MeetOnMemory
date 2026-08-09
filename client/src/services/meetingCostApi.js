import apiClient from "./apiClient";

export const getCostConfig = async () => {
  const response = await apiClient.get("/meeting-cost/config");
  return response.data;
};

export const updateCostConfig = async (configData) => {
  const response = await apiClient.put("/meeting-cost/config", configData);
  return response.data;
};

export const getOrgCostAnalytics = async (params) => {
  const response = await apiClient.get("/meeting-cost/analytics/org", {
    params,
  });
  return response.data;
};

export const getMemberTimeStats = async (params) => {
  const response = await apiClient.get("/meeting-cost/analytics/members", {
    params,
  });
  return response.data;
};

export const exportCostReport = async (params) => {
  const response = await apiClient.get("/meeting-cost/analytics/export", {
    params,
    responseType: "blob", // Important for downloading files
  });
  return response.data;
};
