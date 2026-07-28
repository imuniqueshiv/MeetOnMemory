import api from "./apiClient";

export const meetingSeriesApi = {
  createSeries: (data) => api.post("/meeting-series", data),
  getSeriesById: (id) => api.get(`/meeting-series/${id}`),
  getSeriesMeetings: (id, page = 1, limit = 20) =>
    api.get(`/meeting-series/${id}/meetings?page=${page}&limit=${limit}`),
  cancelSeries: (id) => api.patch(`/meeting-series/${id}/cancel`),
};
