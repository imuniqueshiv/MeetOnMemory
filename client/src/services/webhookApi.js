import apiClient from "./apiClient";

export const webhookApi = {
  getWebhooks: (organizationId) =>
    apiClient.get("/api/webhooks", { params: { organizationId } }),
  createWebhook: (data) => apiClient.post("/api/webhooks", data),
  updateWebhook: (id, data) => apiClient.patch(`/api/webhooks/${id}`, data),
  deleteWebhook: (id) => apiClient.delete(`/api/webhooks/${id}`),
  getDeliveries: (id, params) =>
    apiClient.get(`/api/webhooks/${id}/deliveries`, { params }),
  redeliverPayload: (deliveryId) =>
    apiClient.post(`/api/webhooks/deliveries/${deliveryId}/redeliver`),
};
