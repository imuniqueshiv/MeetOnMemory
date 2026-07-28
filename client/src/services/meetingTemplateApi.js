import apiClient from "./apiClient";

export const meetingTemplateApi = {
  createTemplate: (data) => apiClient.post("/templates", data),
  getTemplates: () => apiClient.get("/templates"),
  updateTemplate: (id, data) => apiClient.put(`/templates/${id}`, data),
  deleteTemplate: (id) => apiClient.delete(`/templates/${id}`),
};
