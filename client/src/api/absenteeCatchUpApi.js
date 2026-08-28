import apiClient from "../services/apiClient";

export const absenteeCatchUpApi = {
  getPendingCatchUps: async () => {
    const response = await apiClient.get("/api/absentee-catchup/pending");
    return response.data;
  },

  getMeetingCatchUp: async (meetingId) => {
    const response = await apiClient.get(
      `/api/absentee-catchup/meeting/${meetingId}`,
    );
    return response.data;
  },

  generateMeetingCatchUp: async (meetingId) => {
    const response = await apiClient.post(
      `/api/absentee-catchup/meeting/${meetingId}/generate`,
    );
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await apiClient.post(
      `/api/absentee-catchup/${id}/mark-read`,
    );
    return response.data;
  },

  deliverCatchUp: async (id) => {
    const response = await apiClient.post(
      `/api/absentee-catchup/${id}/deliver`,
    );
    return response.data;
  },
};
