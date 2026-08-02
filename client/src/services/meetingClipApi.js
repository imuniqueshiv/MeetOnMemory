import apiClient from "./apiClient";

const meetingClipApi = {
  createClip: async (clipData) => {
    const response = await apiClient.post("/clips", clipData);
    return response.data;
  },

  getMeetingClips: async (meetingId) => {
    const response = await apiClient.get(`/clips/meeting/${meetingId}`);
    return response.data;
  },

  updateClip: async (clipId, updateData) => {
    const response = await apiClient.put(`/clips/${clipId}`, updateData);
    return response.data;
  },

  deleteClip: async (clipId) => {
    const response = await apiClient.delete(`/clips/${clipId}`);
    return response.data;
  },

  addClipAnnotation: async (clipId, annotationData) => {
    const response = await apiClient.post(
      `/clips/${clipId}/annotations`,
      annotationData,
    );
    return response.data;
  },
};

export default meetingClipApi;
