import apiClient from "./apiClient";

export const topicApi = {
  getTopicClusters: (orgId) =>
    apiClient.get(`/api/topics/clusters/org/${orgId}`),

  getTopicVelocityAndTrends: (orgId) =>
    apiClient.get(`/api/topics/velocity/org/${orgId}`),

  renameCluster: (clusterId, label) =>
    apiClient.put(`/api/topics/clusters/${clusterId}`, { label }),

  deleteCluster: (clusterId) =>
    apiClient.delete(`/api/topics/clusters/${clusterId}`),

  mergeClusters: (clusterId, targetClusterId) =>
    apiClient.post(`/api/topics/clusters/${clusterId}/merge`, {
      targetClusterId,
    }),

  extractTopicsForOrg: (orgId) =>
    apiClient.post(`/api/topics/extract/org/${orgId}`),

  triggerClustering: (orgId) =>
    apiClient.post(`/api/topics/clusters/org/${orgId}/cluster`),

  getTopicsForMeeting: (meetingId) =>
    apiClient.get(`/api/topics/meeting/${meetingId}`),

  extractTopicsForMeeting: (meetingId) =>
    apiClient.post(`/api/topics/extract/${meetingId}`),
};

export default topicApi;
