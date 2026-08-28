import apiClient from "./apiClient";

export const speakingTimeApi = {
  getBreakdown: (meetingId) =>
    apiClient.get(`/api/speaking-time/${meetingId}/breakdown`),
  getTrends: (limit = 10) =>
    apiClient.get(`/api/speaking-time/trends?limit=${limit}`),
  getOrgCompare: (startDate, endDate) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return apiClient.get("/api/speaking-time/org-compare", { params });
  },
};

export default speakingTimeApi;
