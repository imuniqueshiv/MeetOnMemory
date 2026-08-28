import apiClient from "./apiClient";

export const sessionCardApi = {
  // Generate session card from slides/video + metadata
  generateSession: (formData, config) =>
    apiClient.post("/api/sessions/generate", formData, config),

  // Get all session cards with optional search, pagination, filter
  getSessionCards: (params = {}) => apiClient.get("/api/sessions", { params }),

  // Get session card by ID
  getSessionCardById: (id) => apiClient.get(`/api/sessions/${id}`),

  // Create manual session card
  createSessionCard: (data) => apiClient.post("/api/sessions", data),

  // Update session card
  updateSessionCard: (id, data) => apiClient.patch(`/api/sessions/${id}`, data),

  // Delete session card
  deleteSessionCard: (id) => apiClient.delete(`/api/sessions/${id}`),
};

export default sessionCardApi;
