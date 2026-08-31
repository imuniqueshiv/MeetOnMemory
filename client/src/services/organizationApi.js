import apiClient from "./apiClient";

export const organizationApi = {
  createOrJoinOrganization: (data) =>
    apiClient.post("/api/organizations/create-or-join", data),
  getAllOrganizations: () => apiClient.get("/api/organizations"),
  joinOrganization: (data) => apiClient.post("/api/organizations/join", data),
  getMembers: () => apiClient.get("/api/organizations/members"),
  getUserOrganizations: () => apiClient.get("/api/organizations/user"),
  selectOrganization: (data) =>
    apiClient.post("/api/organizations/select", data),
  getPublicOrganizationBySlug: (slug) =>
    apiClient.get(`/api/organizations/public/${slug}`),
  browsePublicOrganizations: (params) =>
    apiClient.get("/api/organizations/browse", { params }),
  searchOrganizations: (params) =>
    apiClient.get("/api/organizations/search", { params }),
  getOrganizationSettings: (orgId) =>
    apiClient.get("/api/organizations/current/settings", {
      params: orgId ? { orgId } : {},
    }),
  updateOrganizationSettings: (id, data) =>
    apiClient.put(`/api/organizations/${id}`, data),
  getOrganizationById: (idOrSlug) =>
    apiClient.get(`/api/organizations/${idOrSlug}`),
  getLeaderboard: (orgId) =>
    apiClient.get(
      orgId
        ? `/api/organizations/${orgId}/leaderboard`
        : "/api/organizations/current/leaderboard",
    ),
  inviteMember: (orgId, data) =>
    apiClient.post(`/api/organizations/${orgId}/invite`, data),
  acceptInviteToken: (token) =>
    apiClient.post(`/api/organizations/invite/${token}/accept`),
  updateMemberRole: (orgId, userId, role, reason) =>
    apiClient.patch(`/api/organizations/${orgId}/members/${userId}/role`, {
      role,
      reason,
    }),
  deactivateMember: (orgId, userId, reason) =>
    apiClient.patch(
      `/api/organizations/${orgId}/members/${userId}/deactivate`,
      { reason },
    ),
  reactivateMember: (orgId, userId) =>
    apiClient.patch(`/api/organizations/${orgId}/members/${userId}/reactivate`),
  updateMemberCapacity: (orgId, userId, capacity) =>
    apiClient.patch(
      `/api/organizations/${orgId}/members/${userId}/capacity`,
      capacity,
    ),
  getMemberRoleHistory: (orgId, userId) =>
    apiClient.get(`/api/organizations/${orgId}/members/${userId}/role-history`),
  removeMember: (orgId, userId) =>
    apiClient.delete(`/api/organizations/${orgId}/members/${userId}`),
  getAuditLogs: (orgId, params) =>
    apiClient.get(`/api/organizations/${orgId}/audit-logs`, { params }),
  exportAuditLogs: (orgId, params) =>
    apiClient.get(`/api/organizations/${orgId}/audit-logs`, {
      params,
      responseType: "blob",
    }),
  getAuditLogExport: (orgId, exportId) =>
    apiClient.get(`/api/organizations/${orgId}/audit-log-exports/${exportId}`),
  downloadAuditLogExport: (orgId, exportId) =>
    apiClient.get(
      `/api/organizations/${orgId}/audit-log-exports/${exportId}/download`,
      { responseType: "blob" },
    ),
  recordAuditEvent: (orgId, data) =>
    apiClient.post(`/api/organizations/${orgId}/audit`, data),
};
