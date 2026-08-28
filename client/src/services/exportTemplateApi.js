import apiClient from "./apiClient";

/**
 * Client API service for Custom MoM Export Templates and Meeting Document Exports (#2003)
 */
export const exportTemplateApi = {
  /**
   * Fetch all accessible export templates for the user
   */
  getTemplates: async () => {
    const response = await apiClient.get("/api/export-templates");
    return response.data;
  },

  /**
   * Fetch a single export template by ID
   */
  getTemplateById: async (id) => {
    const response = await apiClient.get(`/api/export-templates/${id}`);
    return response.data;
  },

  /**
   * Create a new custom export template
   */
  createTemplate: async (data) => {
    const response = await apiClient.post("/api/export-templates", data);
    return response.data;
  },

  /**
   * Update an existing custom export template
   */
  updateTemplate: async (id, data) => {
    const response = await apiClient.put(`/api/export-templates/${id}`, data);
    return response.data;
  },

  /**
   * Delete an export template by ID
   */
  deleteTemplate: async (id) => {
    const response = await apiClient.delete(`/api/export-templates/${id}`);
    return response.data;
  },

  /**
   * Preview a Handlebars export template with sample meeting data
   */
  previewTemplate: async (data) => {
    const response = await apiClient.post(
      "/api/export-templates/preview",
      data,
    );
    return response.data;
  },

  /**
   * Generate and download meeting export (PDF, DOCX, HTML, MD) using a template
   */
  exportMeeting: async (meetingId, payload) => {
    const response = await apiClient.post(
      `/api/export-templates/meeting/${meetingId}`,
      payload,
      { responseType: "blob" },
    );
    return response;
  },
};

export default exportTemplateApi;
