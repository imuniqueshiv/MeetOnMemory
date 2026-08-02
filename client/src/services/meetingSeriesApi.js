import api from "./apiClient";

export const meetingSeriesApi = {
  createSeries: (data) => api.post("/api/meeting-series", data),
  getSeriesById: (id) => api.get(`/api/meeting-series/${id}`),
  getSeriesMeetings: (id, page = 1, limit = 20) =>
    api.get(`/api/meeting-series/${id}/meetings?page=${page}&limit=${limit}`),
  cancelSeries: (id) => api.patch(`/api/meeting-series/${id}/cancel`),
};
