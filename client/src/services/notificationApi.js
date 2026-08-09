import apiClient from "./apiClient";

export const notificationApi = {
  getNotifications: (params) => apiClient.get("/api/notifications", { params }),
  getUnreadCount: () => apiClient.get("/api/notifications/unread-count"),
  markAsRead: (id) => apiClient.patch(`/api/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch("/api/notifications/mark-all-read"),
  deleteNotification: (id) => apiClient.delete(`/api/notifications/${id}`),
  getPreferences: () => apiClient.get("/api/notifications/preferences"),
  updatePreferences: (data) =>
    apiClient.put("/api/notifications/preferences", data),
};
