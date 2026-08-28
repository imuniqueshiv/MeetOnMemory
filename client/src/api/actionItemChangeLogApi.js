import api from "../services/apiClient.js";

/**
 * Fetch paginated changelogs for an action item
 * @param {string} actionItemId - The ID of the action item
 * @param {object} params - Query parameters (page, limit, type, userId)
 */
export const fetchChangeLogs = async (actionItemId, params = {}) => {
  const { data } = await api.get(`/action-items/${actionItemId}/changelog`, {
    params,
  });
  return data;
};

/**
 * Fetch changelog summary statistics for an action item
 * @param {string} actionItemId - The ID of the action item
 */
export const fetchChangeLogStats = async (actionItemId) => {
  const { data } = await api.get(
    `/action-items/${actionItemId}/changelog/stats`,
  );
  return data;
};
