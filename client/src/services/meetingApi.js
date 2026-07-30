import apiClient from "./apiClient";

export const meetingApi = {
  scheduleMeeting: (data) => apiClient.post("/api/meetings/create", data),
  notifyLive: (data) => apiClient.post("/api/meetings/notify-live", data),
  generateSession: (formData, config) =>
    apiClient.post("/api/sessions/generate", formData, config),

  uploadMeeting: (formData, config) =>
    apiClient.post("/api/meetings/upload", formData, config),

  summarizeMeeting: (data) => apiClient.post("/api/meetings/summarize", data),

  getAllMeetings: (params = {}) =>
    apiClient.get("/api/meetings/all", { params }),

  getMeetingById: (id) => apiClient.get(`/api/meetings/${id}`),

  deleteMeeting: (id) => apiClient.delete(`/api/meetings/delete/${id}`),

  updateMeeting: (id, data) => apiClient.patch(`/api/meetings/${id}`, data),

  exportMeeting: (id, format) =>
    apiClient.get(`/api/meetings/${id}/export?format=${format}`, {
      responseType: "blob",
      timeout: 60000,
    }),

  getReactionSummary: (id) =>
    apiClient.get(`/api/meetings/${id}/reactions/summary`),
  getReactionTimeline: (id) =>
    apiClient.get(`/api/meetings/${id}/reactions/timeline`),

  // Agenda Timer Endpoints
  startAgendaItem: (meetingId, itemId) =>
    apiClient.put(`/api/meetings/timer/${meetingId}/agenda/${itemId}/start`),
  stopAgendaItem: (meetingId, itemId) =>
    apiClient.put(`/api/meetings/timer/${meetingId}/agenda/${itemId}/stop`),
  skipAgendaItem: (meetingId, itemId) =>
    apiClient.put(`/api/meetings/timer/${meetingId}/agenda/${itemId}/skip`),
  getAgendaPacingReport: (meetingId) =>
    apiClient.get(`/api/meetings/timer/${meetingId}/pacing`),
};
