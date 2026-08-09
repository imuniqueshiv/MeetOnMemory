import api from "./apiClient";

export const getFollowUpThreads = async (meetingId) => {
  const response = await api.get(`/follow-up-threads/meeting/${meetingId}`);
  return response.data;
};

export const createFollowUpThread = async (meetingId, data) => {
  const response = await api.post(
    `/follow-up-threads/meeting/${meetingId}`,
    data,
  );
  return response.data;
};

export const createThreadReply = async (threadId, data) => {
  const response = await api.post(
    `/follow-up-threads/${threadId}/replies`,
    data,
  );
  return response.data;
};

export const updateThreadReply = async (replyId, data) => {
  const response = await api.put(`/follow-up-threads/replies/${replyId}`, data);
  return response.data;
};

export const deleteThreadReply = async (replyId) => {
  const response = await api.delete(`/follow-up-threads/replies/${replyId}`);
  return response.data;
};

export const resolveFollowUpThread = async (threadId) => {
  const response = await api.put(`/follow-up-threads/${threadId}/resolve`);
  return response.data;
};
