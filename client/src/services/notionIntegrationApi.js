import apiClient from "./apiClient.js";

const BASE_URL = "/api/integrations/notion";

export const notionIntegrationApi = {
  getStatus: () => apiClient.get(`${BASE_URL}/status`),
  getAuthUrl: () => apiClient.get(`${BASE_URL}/auth`),
  getDatabases: () => apiClient.get(`${BASE_URL}/databases`),
  saveMapping: (databaseId) =>
    apiClient.post(`${BASE_URL}/mapping`, { databaseId }),
  disconnect: () => apiClient.delete(`${BASE_URL}/disconnect`),
  syncMeeting: (meetingId, force = false) =>
    apiClient.post(`${BASE_URL}/sync`, { meetingId, force }),
  getHistory: (params = {}) => apiClient.get(`${BASE_URL}/history`, { params }),
  retrySync: (meetingId) =>
    apiClient.post(`${BASE_URL}/sync`, { meetingId, force: true }),
};
