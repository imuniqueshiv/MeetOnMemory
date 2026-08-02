import apiClient from "./apiClient";

// Base URL for the recap API routes
const API_URL = "/api/recap";

/**
 * Fetch current user's recap preferences
 */
export const getRecapPreferences = async () => {
  const response = await apiClient.get(`${API_URL}/preferences`);
  return response.data;
};

/**
 * Update current user's recap preferences
 */
export const updateRecapPreferences = async (preferencesData) => {
  const response = await apiClient.put(
    `${API_URL}/preferences`,
    preferencesData,
  );
  return response.data;
};

/**
 * Preview the recap email with current unsaved preferences
 * Returns raw HTML string
 */
export const previewRecapEmail = async (preferencesData) => {
  const response = await apiClient.post(`${API_URL}/preview`, preferencesData, {
    responseType: "text", // Since the endpoint returns raw HTML
  });
  return response.data;
};
