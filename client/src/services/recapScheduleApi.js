import apiClient from "./apiClient";

export const recapScheduleApi = {
  getSchedule: (organizationId) =>
    apiClient.get(`/api/recap-schedule/${organizationId}`),
  upsertSchedule: (organizationId, data) =>
    apiClient.put(`/api/recap-schedule/${organizationId}`, data),
  getDeliveryHistory: () =>
    apiClient.get("/api/recap-schedule/history/deliveries"),
  retryDelivery: (deliveryId) =>
    apiClient.post(`/api/recap-schedule/retry/${deliveryId}`),
};
