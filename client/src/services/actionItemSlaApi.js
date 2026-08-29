import apiClient from "./apiClient";

const API_URL = "/api/action-item-sla";

/**
 * Get SLA configuration for an organization
 * @param {string} organizationId
 * @returns {Promise<Object>}
 */
export const getSlaConfig = async (organizationId) => {
  const response = await apiClient.get(`${API_URL}/config/${organizationId}`);
  return response.data;
};

/**
 * Update SLA configuration
 * @param {string} organizationId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export const updateSlaConfig = async (organizationId, updates) => {
  const response = await apiClient.put(
    `${API_URL}/config/${organizationId}`,
    updates,
  );
  return response.data;
};

/**
 * Get all SLA breaches for an organization
 * @param {string} organizationId
 * @param {Object} params query filters (e.g. status)
 * @returns {Promise<Array>}
 */
export const getSlaBreaches = async (organizationId, params = {}) => {
  const response = await apiClient.get(`${API_URL}/breaches/${organizationId}`, {
    params,
  });
  return response.data;
};

/**
 * Get SLA compliance statistics
 * @param {string} organizationId
 * @returns {Promise<Object>}
 */
export const getSlaComplianceStats = async (organizationId) => {
  const response = await apiClient.get(`${API_URL}/stats/${organizationId}`);
  return response.data;
};

/**
 * Acknowledge an SLA breach
 * @param {string} breachId
 * @returns {Promise<Object>}
 */
export const acknowledgeBreach = async (breachId) => {
  const response = await apiClient.post(
    `${API_URL}/breach/${breachId}/acknowledge`,
  );
  return response.data;
};
