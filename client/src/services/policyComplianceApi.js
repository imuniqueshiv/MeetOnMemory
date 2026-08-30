import apiClient from "./apiClient.js";
export const getWorkerStatus = () =>
  api.get("/policy-compliance/worker-status");
export const policyComplianceApi = {
  getFlags: (status = "unresolved", classification = "all") =>
    apiClient.get(
      `/api/policy-compliance/flags?status=${encodeURIComponent(status)}&classification=${encodeURIComponent(classification)}`,
    ),
  getDecisionCompliance: (decisionId) =>
    apiClient.get(`/api/policy-compliance/decisions/${decisionId}`),
  getPolicyRelatedDecisions: (policyId) =>
    apiClient.get(
      `/api/policy-compliance/policies/${policyId}/related-decisions`,
    ),
  getPolicyVersion: (policyId, version) =>
    apiClient.get(
      `/api/policy-compliance/policies/${policyId}/versions/${encodeURIComponent(version)}`,
    ),
  exportEvidence: (flagId, format = "zip") =>
    apiClient.get(
      `/api/policy-compliance/flags/${flagId}/export?format=${format}`,
      {
        responseType: "blob",
        timeout: 60000,
      },
    ),
  updateFlagStatus: (flagId, status) =>
    apiClient.patch(`/api/policy-compliance/flags/${flagId}`, { status }),
  reEvaluate: (flagId) =>
    apiClient.post("/api/policy-compliance/re-evaluate", { flagId }),
};
