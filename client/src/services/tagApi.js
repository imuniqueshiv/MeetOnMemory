import apiClient from "./apiClient";

export const tagApi = {
  // Create a new tag (admin only)
  createTag: async (tagData) => {
    return await apiClient.post("/api/tags", tagData);
  },

  // Get all tags for the organization
  getOrgTags: async () => {
    return await apiClient.get("/api/tags");
  },

  // Update a tag (admin only)
  updateTag: async (id, tagData) => {
    return await apiClient.put(`/api/tags/${id}`, tagData);
  },

  // Delete a tag (admin only)
  deleteTag: async (id) => {
    return await apiClient.delete(`/api/tags/${id}`);
  },

  // Autocomplete tags based on query prefix
  autocomplete: async (query) => {
    return await apiClient.get(
      `/api/tags/autocomplete?q=${encodeURIComponent(query)}`,
    );
  },

  // Get tag statistics (top tags)
  getTagStats: async () => {
    return await apiClient.get("/api/tags/stats");
  },

  // Get meetings for a specific tag with pagination
  getMeetingsByTag: async (name, page = 1, limit = 10) => {
    return await apiClient.get(
      `/api/tags/${encodeURIComponent(name)}/meetings?page=${page}&limit=${limit}`,
    );
  },
};
