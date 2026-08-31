import apiClient from "../services/apiClient";

export const debriefQAApi = {
  askQuestion: async (meetingId, question) => {
    const response = await apiClient.post("/api/debrief/session", {
      meetingId,
      question,
    });
    return response.data;
  },

  getSession: async (meetingId) => {
    const response = await apiClient.get(`/api/debrief/session/${meetingId}`);
    return response.data;
  },
};
