import apiClient from "../services/apiClient";

const API_URL = "/api/comments";

export const createComment = async (meetingId, body, parentComment = null) => {
  const response = await apiClient.post(
    `${API_URL}`,
    {
      meetingId,
      body,
      parentComment,
    },
    { withCredentials: true },
  );
  return response.data;
};

export const getCommentsByMeeting = async (meetingId, page = 1, limit = 50) => {
  const response = await apiClient.get(
    `${API_URL}/meeting/${meetingId}?page=${page}&limit=${limit}`,
    { withCredentials: true },
  );
  return response.data;
};

export const updateComment = async (commentId, body) => {
  const response = await apiClient.patch(
    `${API_URL}/${commentId}`,
    { body },
    { withCredentials: true },
  );
  return response.data;
};

export const deleteComment = async (commentId) => {
  const response = await apiClient.delete(`${API_URL}/${commentId}`, {
    withCredentials: true,
  });
  return response.data;
};

export const toggleReaction = async (commentId, emoji) => {
  const response = await apiClient.post(
    `${API_URL}/${commentId}/reactions`,
    { emoji },
    { withCredentials: true },
  );
  return response.data;
};
