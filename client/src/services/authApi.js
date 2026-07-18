import apiClient from "./apiClient";

export const authApi = {
  login: (credentials) => apiClient.post("/api/auth/login", credentials),
  register: (userData) => apiClient.post("/api/auth/register", userData),
  logout: () => apiClient.post("/api/auth/logout", {}),
  getAuthState: () => apiClient.get("/api/auth/is-auth"),
  getUserData: () => apiClient.get("/api/auth/user-data"),
  sendVerifyOtp: () => apiClient.post("/api/auth/send-verify-otp", {}),
  verifyAccount: (data) => apiClient.post("/api/auth/verify-account", data),
  sendResetOtp: (data) => apiClient.post("/api/auth/send-reset-otp", data),
  resetPassword: (data) => apiClient.post("/api/auth/reset-password", data),
  getCsrfToken: () => apiClient.get("/api/csrf-token"),
};
