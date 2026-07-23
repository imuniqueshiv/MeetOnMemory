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
  getLeaderboard: (organizationId, limit = 10) =>
    apiClient.get(
      `/api/memberships/organization/${organizationId}/leaderboard`,
      {
        params: { limit },
      },
    ),
};
