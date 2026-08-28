import apiClient from "./apiClient";

const sentimentTimelineApi = {
  getTimeline: (meetingId) =>
    apiClient.get(`/api/sentiment-timeline/${meetingId}`),
  generateTimeline: (meetingId) =>
    apiClient.post(`/api/sentiment-timeline/${meetingId}/generate`),
  getOrgTrends: (organizationId, params = {}) =>
    apiClient.get(
      `/api/sentiment-timeline/organization/${organizationId}/trends`,
      { params },
    ),
};

export default sentimentTimelineApi;
