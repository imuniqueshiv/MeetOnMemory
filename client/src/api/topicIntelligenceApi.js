import apiClient from "../services/apiClient.js";

export const getDashboardData = async (includeHidden = false) => {
  const { data } = await apiClient.get(
    `/api/topic-intelligence/dashboard?includeHidden=${includeHidden}`,
  );
  return data;
};

export const getOrphanedTopics = async () => {
  const { data } = await apiClient.get("/api/topic-intelligence/orphaned");
  return data;
};

export const getCoOccurrenceGraph = async (includeHidden = false) => {
  const { data } = await apiClient.get(
    `/api/topic-intelligence/graph?includeHidden=${includeHidden}`,
  );
  return data;
};

export const generateBriefing = async (clusterId) => {
  const { data } = await apiClient.post(
    `/api/topic-intelligence/${clusterId}/briefing`,
  );
  return data;
};

export const pinTopic = async (clusterId, isPinned) => {
  const { data } = await apiClient.put(
    `/api/topic-intelligence/${clusterId}/pin`,
    { isPinned },
  );
  return data;
};

export const hideTopic = async (clusterId, isHidden) => {
  const { data } = await apiClient.put(
    `/api/topic-intelligence/${clusterId}/hide`,
    { isHidden },
  );
  return data;
};

export const mergeTopics = async (sourceClusterId, targetClusterId) => {
  const { data } = await apiClient.post(`/api/topic-intelligence/merge`, {
    sourceClusterId,
    targetClusterId,
  });
  return data;
};

export const exportTopicIntelligence = async (format = "json") => {
  const response = await apiClient.get(
    `/api/topic-intelligence/export?format=${format}`,
    { responseType: "blob" },
  );
  return response.data;
};
