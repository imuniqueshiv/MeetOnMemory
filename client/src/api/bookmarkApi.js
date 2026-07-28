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

export const getBookmarksAPI = async (collectionName) => {
  const params = collectionName ? { collectionName } : {};
  const response = await apiClient.get("/api/bookmarks", { params });
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

export const getBookmarkStatusAPI = async (meetingId) => {
  const response = await apiClient.get(`/api/bookmarks/status/${meetingId}`);
  return response.data;
};
