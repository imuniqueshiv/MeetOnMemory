import apiClient from "./apiClient";

/** Clerk-era auth API — identity is owned by Clerk; these probe/sync Mongo. */
export const authApi = {
  logout: (config) => apiClient.post("/api/auth/logout", {}, config),
  getAuthState: (config) => apiClient.get("/api/auth/is-auth", config),
  getUserData: (config) => apiClient.get("/api/auth/user-data", config),
  syncClerkUser: (payload = {}, config) =>
    apiClient.post("/api/auth/sync-clerk-user", payload, config),
};
