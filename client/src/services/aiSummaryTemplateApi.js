import apiClient from "./apiClient";

const aiSummaryTemplateApi = {
  createTemplate: (data) => apiClient.post("/ai-summary-templates", data),
  getTemplates: () => apiClient.get("/ai-summary-templates"),
  getTemplateById: (id) => apiClient.get(`/ai-summary-templates/${id}`),
  updateTemplate: (id, data) =>
    apiClient.put(`/ai-summary-templates/${id}`, data),
  deleteTemplate: (id) => apiClient.delete(`/ai-summary-templates/${id}`),
  setDefaultTemplate: (id) =>
    apiClient.put(`/ai-summary-templates/${id}/default`),
  testTemplate: (data) => apiClient.post(`/ai-summary-templates/test`, data),
};

export default aiSummaryTemplateApi;
