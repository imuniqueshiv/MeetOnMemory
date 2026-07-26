import apiClient from "./apiClient";

export const policyComplianceApi = {
  getFlags: (status = "unresolved", classification = "potential_conflict") =>
    apiClient.get(
      `/api/policy-compliance/flags?status=${status}&classification=${classification}`,
    ),
  getDecisionCompliance: (decisionId) =>
    apiClient.get(`/api/policy-compliance/decisions/${decisionId}`),
  getPolicyRelatedDecisions: (policyId) =>
    apiClient.get(
      `/api/policy-compliance/policies/${policyId}/related-decisions`,
    ),
  updateFlagStatus: (flagId, status) =>
    apiClient.patch(`/api/policy-compliance/flags/${flagId}`, { status }),
};
