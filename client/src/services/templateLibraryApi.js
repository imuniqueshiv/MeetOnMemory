import api from "./apiClient";

// Publish a template to the library
export const publishTemplate = async (templateData) => {
  const response = await api.post("/template-library", templateData);
  return response.data;
};

// Browse templates
export const browseTemplates = async (params) => {
  const response = await api.get("/template-library", { params });
  return response.data;
};

// Clone a template
export const cloneTemplate = async (templateId) => {
  const response = await api.post(`/template-library/${templateId}/clone`);
  return response.data;
};

// Rate a template
export const rateTemplate = async (templateId, ratingData) => {
  const response = await api.post(
    `/template-library/${templateId}/rate`,
    ratingData,
  );
  return response.data;
};
