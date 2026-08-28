import apiClient from "../services/apiClient";

export const debriefQAApi = {
  askQuestion: async (meetingId, question) => {
    const response = await apiClient.post("/debrief/session", {
      meetingId,
      question,
    });
    return response.data;
  },

  getSession: async (meetingId) => {
    const response = await apiClient.get(`/debrief/session/${meetingId}`);
    return response.data;
  },
};
