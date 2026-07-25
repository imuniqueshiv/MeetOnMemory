import apiClient from "./apiClient";

export const sharedLinkApi = {
  createLink: (data) => apiClient.post("/shared-links", data),
  getActiveLinks: (resourceType, resourceId) =>
    apiClient.get(`/shared-links/${resourceType}/${resourceId}`),
  revokeLink: (id) => apiClient.delete(`/shared-links/${id}`),
};

export const publicSharedApi = {
  verifyPasscode: (hash, data) =>
    apiClient.post(`/public/shared/${hash}/verify`, data),
  getPublicResource: (hash) => apiClient.get(`/public/shared/${hash}`),
};
