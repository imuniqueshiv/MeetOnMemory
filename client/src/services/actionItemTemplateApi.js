import apiClient from "./apiClient";

const API_URL = "/api/action-item-templates";

export const getTemplates = async () => {
  const response = await apiClient.get(API_URL);
  return response.data;
};

export const getTemplateById = async (id) => {
  const response = await apiClient.get(`${API_URL}/${id}`);
  return response.data;
};

export const createTemplate = async (templateData) => {
  const response = await apiClient.post(API_URL, templateData);
  return response.data;
};

export const updateTemplate = async (id, templateData) => {
  const response = await apiClient.put(`${API_URL}/${id}`, templateData);
  return response.data;
};

export const deleteTemplate = async (id) => {
  const response = await apiClient.delete(`${API_URL}/${id}`);
  return response.data;
};

export const applyTemplateToMeeting = async (templateId, meetingId) => {
  const response = await apiClient.post(`${API_URL}/apply`, {
    templateId,
    meetingId,
  });
  return response.data;
};
