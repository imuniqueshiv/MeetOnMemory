import apiClient from "./apiClient.js";

export const transcriptApi = {
  getTranscriptByMeeting: async (meetingId) => {
    const response = await apiClient.get(
      `/api/transcripts/meeting/${meetingId}`,
    );
    return response.data?.data || response.data;
  },

  updateSegment: async (transcriptId, segmentIndex, payload) => {
    const response = await apiClient.patch(
      `/api/transcripts/${transcriptId}/segments/${segmentIndex}`,
      payload,
    );
    return response.data?.data || response.data;
  },

  updateMeetingSegment: async (meetingId, segmentIndex, payload) => {
    const response = await apiClient.patch(
      `/api/transcripts/meeting/${meetingId}/segments/${segmentIndex}`,
      payload,
    );
    return response.data?.data || response.data;
  },
};

export default transcriptApi;
