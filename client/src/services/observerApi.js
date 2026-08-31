import apiClient from "./apiClient.js";

/**
 * Get pending shadow requests for a meeting
 * @param {string} meetingId
 * @returns {Promise<Object>} Response data containing pending observers
 */
export const getPendingShadowRequests = async (meetingId) => {
  const response = await apiClient.get(`/api/observers/${meetingId}/pending`);
  return response.data;
};

/**
 * Requests to shadow a meeting as an observer
 * @param {string} meetingId
 * @returns {Promise<Object>} Response data
 */
export const requestToShadow = async (meetingId) => {
  const response = await apiClient.post(`/api/observers/${meetingId}/request`);
  return response.data;
};

/**
 * Approves a shadow request for a specific user
 * @param {string} meetingId
 * @param {string} userId
 * @returns {Promise<Object>} Response data containing the updated meeting
 */
export const approveShadowRequest = async (meetingId, userId) => {
  const response = await apiClient.put(
    `/api/observers/${meetingId}/approve/${userId}`,
  );
  return response.data;
};

/**
 * Denies a shadow request for a specific user
 * @param {string} meetingId
 * @param {string} userId
 * @returns {Promise<Object>} Response data
 */
export const denyShadowRequest = async (meetingId, userId) => {
  const response = await apiClient.put(
    `/api/observers/${meetingId}/deny/${userId}`,
  );
  return response.data;
};
