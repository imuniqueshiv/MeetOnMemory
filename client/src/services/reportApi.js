import apiClient from "./apiClient.js";

const reportApi = {
  getTemplates: async () => {
    const response = await apiClient.get("/reports/templates");
    return response.data;
  },

  getTemplateById: async (id) => {
    const response = await apiClient.get(`/reports/templates/${id}`);
    return response.data;
  },

  createTemplate: async (data) => {
    const response = await apiClient.post("/reports/templates", data);
    return response.data;
  },

  updateTemplate: async (id, data) => {
    const response = await apiClient.put(`/reports/templates/${id}`, data);
    return response.data;
  },

  deleteTemplate: async (id) => {
    const response = await apiClient.delete(`/reports/templates/${id}`);
    return response.data;
  },

  generateReport: async (id, filterOverrides = {}) => {
    const response = await apiClient.post(`/reports/generate/${id}`, {
      filterOverrides,
    });
    return response.data;
  },
};

export default reportApi;
