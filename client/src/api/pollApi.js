import apiClient from "../services/apiClient";

const API_URL = "/api/polls";

export const createPoll = async (pollData) => {
  const response = await apiClient.post(`${API_URL}`, pollData, {
    withCredentials: true,
  });
  return response.data;
};

export const getPollsByMeeting = async (meetingId) => {
  const response = await apiClient.get(`${API_URL}/meeting/${meetingId}`, {
    withCredentials: true,
  });
  return response.data;
};

export const castVote = async (pollId, optionIds) => {
  const response = await apiClient.post(
    `${API_URL}/${pollId}/vote`,
    { optionIds },
    { withCredentials: true },
  );
  return response.data;
};

export const closePoll = async (pollId) => {
  const response = await apiClient.patch(
    `${API_URL}/${pollId}/close`,
    {},
    { withCredentials: true },
  );
  return response.data;
};

export const deletePoll = async (pollId) => {
  const response = await apiClient.delete(`${API_URL}/${pollId}`, {
    withCredentials: true,
  });
  return response.data;
};
