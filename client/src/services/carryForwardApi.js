import api from "./apiClient.js";

const carryForwardApi = {
  getConfig: (seriesId) =>
    api.get(`/api/meeting-series/${seriesId}/carry-forward/config`),

  updateConfig: (seriesId, carryForwardRules) =>
    api.put(`/api/meeting-series/${seriesId}/carry-forward/config`, {
      carryForwardRules,
    }),

  getPreview: (seriesId) =>
    api.get(`/api/meeting-series/${seriesId}/carry-forward/preview`),

  applyCarryForward: (seriesId, currentMeetingId) =>
    api.post(`/api/meeting-series/${seriesId}/carry-forward/apply`, {
      currentMeetingId,
    }),

  getMeetingPreview: (meetingId) =>
    api.get(`/api/meetings/${meetingId}/carry-forward/preview`),

  applyMeetingCarryForward: (meetingId, seriesId) =>
    api.post(`/api/meetings/${meetingId}/carry-forward/apply`, { seriesId }),

  getHistory: (seriesId) =>
    api.get(`/api/series/${seriesId}/carry-forward/history`),
};

export default carryForwardApi;
