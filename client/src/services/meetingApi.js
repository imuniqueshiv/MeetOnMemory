import apiClient from "./apiClient";

export const meetingApi = {
  scheduleMeeting: (data) => apiClient.post("/api/meetings/create", data),
  notifyLive: (data) => apiClient.post("/api/meetings/notify-live", data),
  generateSession: (formData, config) =>
    apiClient.post("/api/sessions/generate", formData, config),
  getSessionCards: (params = {}) => apiClient.get("/api/sessions", { params }),
  getSessionCardById: (id) => apiClient.get(`/api/sessions/${id}`),
  deleteSessionCard: (id) => apiClient.delete(`/api/sessions/${id}`),

  uploadMeeting: (formData, config) =>
    apiClient.post("/api/meetings/upload", formData, config),

  // Resumable Chunk Upload Endpoints (#2268)
  initResumableUpload: (data) =>
    apiClient.post("/api/meetings/upload/init", data),
  uploadChunk: (formData, config) =>
    apiClient.post("/api/meetings/upload/chunk", formData, config),
  getUploadStatus: (uploadId) =>
    apiClient.get(`/api/meetings/upload/status/${uploadId}`),
  completeResumableUpload: (data) =>
    apiClient.post("/api/meetings/upload/complete", data),
  abortResumableUpload: (data) =>
    apiClient.post("/api/meetings/upload/abort", data),

  summarizeMeeting: (data) => apiClient.post("/api/meetings/summarize", data),

  getAllMeetings: (params = {}, config = {}) =>
    apiClient.get("/api/meetings/all", { params, ...config }),

  getMeetingById: (id) => apiClient.get(`/api/meetings/${id}`),

  deleteMeeting: (id, reason) =>
    apiClient.delete(`/api/meetings/delete/${id}`, { data: { reason } }),

  getDeletedMeetings: (params = {}) =>
    apiClient.get("/api/meetings/trash", { params }),

  restoreDeletedMeeting: (id) =>
    apiClient.post(`/api/meetings/${id}/restore-deleted`),

  permanentlyDeleteMeeting: (id) =>
    apiClient.delete(`/api/meetings/${id}/permanent`),

  getPurgePreview: () => apiClient.get("/api/meetings/trash/purge-preview"),

  purgeTrash: () => apiClient.delete("/api/meetings/trash/purge"),

  updateMeeting: (id, data) => apiClient.patch(`/api/meetings/${id}`, data),

  exportMeeting: (id, format) =>
    apiClient.get(`/api/meetings/${id}/export?format=${format}`, {
      responseType: "blob",
      timeout: 60000,
    }),

  sendMeetingDigest: (id) =>
    apiClient.post(`/api/meetings/${id}/digest/resend`),
  previewMeetingDigest: (id) =>
    apiClient.get(`/api/meetings/${id}/digest/preview`),

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

  getInvite: (meetingId) => apiClient.get(`/api/meetings/${meetingId}/invite`),
  regenerateInvite: (meetingId) =>
    apiClient.post(`/api/meetings/${meetingId}/invite/regenerate`),
  updateInvite: (meetingId, data) =>
    apiClient.patch(`/api/meetings/${meetingId}/invite`, data),
  resolveInvite: (code) => apiClient.get(`/api/meetings/invite/${code}`),

  resendDigest: (meetingId) =>
    apiClient.post(`/api/meetings/${meetingId}/digest/resend`),
  previewDigest: (meetingId) =>
    apiClient.get(`/api/meetings/${meetingId}/digest/preview`, {
      responseType: "text",
    }),
  getDigestStatus: (meetingId) =>
    apiClient.get(`/api/meetings/${meetingId}/digest/status`),
};
