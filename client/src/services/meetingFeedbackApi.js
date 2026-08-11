import apiClient from "./apiClient";

export const meetingFeedbackApi = {
  submitFeedback: (data) => apiClient.post("/api/feedback", data),
  getFeedbackForMeeting: (meetingId) =>
    apiClient.get(`/api/feedback/meeting/${meetingId}`),
  getUserFeedbackForMeeting: (meetingId) =>
    apiClient.get(`/api/feedback/meeting/${meetingId}/user`),
  getAggregateFeedback: (orgId) =>
    apiClient.get(`/api/feedback/aggregate/${orgId}`),
  deleteFeedback: (id) => apiClient.delete(`/api/feedback/${id}`),
};
