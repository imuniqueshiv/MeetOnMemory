import apiClient from "./apiClient.js";

const meetingGoalApi = {
  setGoals: (meetingId, data) =>
    apiClient.post(`/api/meeting-goals/meeting/${meetingId}`, data),

  getGoals: (meetingId) =>
    apiClient.get(`/api/meeting-goals/meeting/${meetingId}`),

  updateGoalStatus: (meetingId, goalId, data) =>
    apiClient.patch(
      `/api/meeting-goals/meeting/${meetingId}/goal/${goalId}`,
      data,
    ),

  getOrgGoalStats: (orgId) =>
    apiClient.get(`/api/meeting-goals/org/${orgId}/stats`),

  getSeriesGoalRollup: (meetingId) =>
    apiClient.get(`/api/meeting-goals/meeting/${meetingId}/series-rollup`),
};

export default meetingGoalApi;
