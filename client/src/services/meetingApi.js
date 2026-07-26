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
};
