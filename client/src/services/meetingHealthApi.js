import apiClient from "./apiClient.js";

const getMeetingHealth = async (meetingId) => {
  const response = await apiClient.get(`/api/meeting-health/${meetingId}`);
  return response.data;
};

const getOrganizationHealthTrends = async (organizationId) => {
  const response = await apiClient.get(
    `/api/meeting-health/trends/${organizationId}`,
  );
  return response.data;
};

export const meetingHealthApi = {
  getMeetingHealth,
  getOrganizationHealthTrends,
};
