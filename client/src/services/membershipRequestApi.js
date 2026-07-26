import apiClient from "./apiClient";

export const membershipRequestApi = {
  // Get organization membership requests with search, filter, pagination, and sorting
  getOrganizationRequests: (organizationId, params = {}) =>
    apiClient.get(`/api/membership-requests/organization/${organizationId}`, {
      params,
    }),

  // Get user's membership requests
  getUserRequests: () => apiClient.get("/api/membership-requests/user"),

  // Create membership request
  createRequest: (data) => apiClient.post("/api/membership-requests", data),

  // Approve membership request
  approveRequest: (requestId, reviewNotes) =>
    apiClient.patch(`/api/membership-requests/${requestId}/approve`, {
      reviewNotes,
    }),

  // Reject membership request
  rejectRequest: (requestId, reviewNotes) =>
    apiClient.patch(`/api/membership-requests/${requestId}/reject`, {
      reviewNotes,
    }),

  // Cancel membership request
  cancelRequest: (requestId) =>
    apiClient.patch(`/api/membership-requests/${requestId}/cancel`),

  // Bulk approve membership requests
  bulkApproveRequests: (requestIds, reviewNotes) =>
    apiClient.post("/api/membership-requests/bulk-approve", {
      requestIds,
      reviewNotes,
    }),

  // Bulk reject membership requests
  bulkRejectRequests: (requestIds, reviewNotes) =>
    apiClient.post("/api/membership-requests/bulk-reject", {
      requestIds,
      reviewNotes,
    }),
};
