import apiClient from "../services/apiClient.js";

export const toggleBookmarkAPI = async (
  meetingId,
  collectionName,
  notes,
  color,
) => {
  const response = await apiClient.post("/api/bookmarks/toggle", {
    meetingId,
    collectionName,
    notes,
    color,
  });
  return response.data;
};

export const getBookmarksAPI = async (collectionName, search) => {
  const params = {};
  if (collectionName) params.collectionName = collectionName;
  if (search) params.search = search;
  const response = await apiClient.get("/api/bookmarks", { params });
  return response.data;
};

export const shareCollectionAPI = async (name, emails) => {
  const response = await apiClient.post(
    `/api/bookmarks/collections/${encodeURIComponent(name)}/share`,
    { emails },
  );
  return response.data;
};

export const getCollectionsAPI = async () => {
  const response = await apiClient.get("/api/bookmarks/collections");
  return response.data;
};

export const updateBookmarkAPI = async (id, data) => {
  const response = await apiClient.put(`/api/bookmarks/${id}`, data);
  return response.data;
};

export const deleteCollectionAPI = async (name) => {
  const response = await apiClient.delete(`/api/bookmarks/collections/${name}`);
  return response.data;
};

export const updateCollectionAPI = async (name, data) => {
  const response = await apiClient.put(
    `/api/bookmarks/collections/${encodeURIComponent(name)}`,
    data,
  );
  return response.data;
};

export const getBookmarkStatusAPI = async (meetingId) => {
  const response = await apiClient.get(`/api/meetings/${meetingId}/bookmark`);
  return response.data;
};

export const addMeetingBookmarkAPI = async (
  meetingId,
  collectionName,
  notes,
  color,
) => {
  const response = await apiClient.post(`/api/meetings/${meetingId}/bookmark`, {
    collectionName,
    notes,
    color,
  });
  return response.data;
};

export const removeMeetingBookmarkAPI = async (meetingId) => {
  const response = await apiClient.delete(
    `/api/meetings/${meetingId}/bookmark`,
  );
  return response.data;
};

export const getBookmarkedMeetingsAPI = async (collectionName) => {
  const params = collectionName ? { collectionName } : {};
  const response = await apiClient.get("/api/meetings/bookmarked", { params });
  return response.data;
};
