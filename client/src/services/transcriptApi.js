import apiClient from "./apiClient.js";

export const transcriptApi = {
  getTranscriptByMeetingId: (meetingId) =>
    apiClient.get(`/api/transcripts/meeting/${meetingId}`),

  updateSpeaker: (transcriptId, data) =>
    apiClient.put(`/api/transcripts/${transcriptId}/speakers`, data),

  searchTranscript: (meetingId, query) =>
    apiClient.post(`/api/transcripts/meeting/${meetingId}/search`, { query }),

  exportText: (meetingId) =>
    apiClient.get(`/api/transcripts/meeting/${meetingId}/export/text`, {
      responseType: "blob",
    }),

  exportPDF: (meetingId) =>
    apiClient.get(`/api/transcripts/meeting/${meetingId}/export/pdf`, {
      responseType: "blob",
    }),
};
