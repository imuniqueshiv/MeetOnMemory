import apiClient from "./apiClient";

export const policyApi = {
  getPolicies: () => apiClient.get("/api/policies"),
  uploadPolicy: (formData, isUpdate = false, config = {}) =>
    apiClient.post(
      `/api/policies/upload${isUpdate ? "?update=true" : ""}`,
      formData,
      config,
    ),
  downloadPolicy: (policyId) =>
    apiClient.get(`/api/policies/download/${policyId}`, {
      responseType: "blob",
    }),
  deletePolicy: (policyId) => apiClient.delete(`/api/policies/${policyId}`),
  analyzePolicy: (policyId) =>
    apiClient.post(`/api/policies/${policyId}/analyze`),
  compareVersions: (policyId, from, to) =>
    apiClient.get(`/api/policies/${policyId}/diff`, {
      params: { from, to },
    }),
};
