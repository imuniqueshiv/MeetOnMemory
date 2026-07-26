import apiClient from "./apiClient";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:4000" : null);

const googleLogin = () => {
  if (!backendUrl) {
    throw new Error("VITE_BACKEND_URL is not configured.");
  }

  window.location.href = `${backendUrl}/api/auth/google`;
};

export const authApi = {
  login: (credentials) => apiClient.post("/api/auth/login", credentials),
  register: (userData) => apiClient.post("/api/auth/register", userData),
  logout: () => apiClient.post("/api/auth/logout", {}),
  getAuthState: () => apiClient.get("/api/auth/is-auth"),
  getUserData: () => apiClient.get("/api/auth/user-data"),
  sendVerifyOtp: () => apiClient.post("/api/auth/send-verify-otp", {}),
  verifyAccount: (data) => apiClient.post("/api/auth/verify-email", data),
  sendResetOtp: (data) => apiClient.post("/api/auth/send-reset-otp", data),
  resetPassword: (data) => apiClient.post("/api/auth/reset-password", data),
  googleLogin,
};
