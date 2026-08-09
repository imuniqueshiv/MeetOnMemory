import apiClient from "./apiClient";

export const meetingTemplateApi = {
  createTemplate: (data) => apiClient.post("/api/templates", data),
  getTemplates: () => apiClient.get("/api/templates"),
  getTemplateById: (id) => apiClient.get(`/api/templates/${id}`),
  updateTemplate: (id, data) => apiClient.put(`/api/templates/${id}`, data),
  deleteTemplate: (id) => apiClient.delete(`/api/templates/${id}`),
};
