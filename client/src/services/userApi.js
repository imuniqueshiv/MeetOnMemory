import apiClient from "./apiClient";

export const userApi = {
  updateProfile: (data) => apiClient.put("/api/user/update", data),
  getDashboardPreferences: () =>
    apiClient.get("/api/user/preferences/dashboard"),
  updateDashboardPreferences: (data) =>
    apiClient.put("/api/user/preferences/dashboard", data),
};
