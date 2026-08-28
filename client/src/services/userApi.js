import apiClient from "./apiClient";

export const userApi = {
  updateProfile: (data) => apiClient.put("/api/user/update", data),
  uploadAvatar: (formData) =>
    apiClient.post("/api/user/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  getDashboardPreferences: () =>
    apiClient.get("/api/user/preferences/dashboard"),
  updateDashboardPreferences: (data) =>
    apiClient.put("/api/user/preferences/dashboard", data),
  requestDataExport: () => apiClient.post("/api/user/request-data-export"),
  getDataExportStatus: () => apiClient.get("/api/user/data-export-status"),
  downloadExport: (token) =>
    apiClient.get(`/api/user/download-export/${token}`, {
      responseType: "blob",
    }),
};

export default userApi;
