import apiClient from "./apiClient";

export const invitationApi = {
  createInvitation: (data) => apiClient.post("/api/invitation", data),
  getOrganizationInvitations: (organizationId, status) => {
    const url = `/api/invitation/organization/${organizationId}`;
    return apiClient.get(url, { params: status ? { status } : {} });
  },
  getUserInvitations: () => apiClient.get("/api/invitation/user"),
  acceptInvitation: (token) => apiClient.post(`/api/invitation/${token}/accept`),
  rejectInvitation: (token) => apiClient.post(`/api/invitation/${token}/reject`),
  revokeInvitation: (id) => apiClient.delete(`/api/invitation/${id}`),
  resendInvitation: (id) => apiClient.post(`/api/invitation/${id}/resend`),
  expireInvitation: (id) => apiClient.post(`/api/invitation/${id}/expire`),
  getInvitationByToken: (token) => apiClient.get(`/api/invitation/${token}`),
};
