import axios from "axios";

const API_URL = "/api/polls";

export const createPoll = async (pollData) => {
  const response = await axios.post(`${API_URL}`, pollData, {
    withCredentials: true,
  });
  return response.data;
};

export const getPollsByMeeting = async (meetingId) => {
  const response = await axios.get(`${API_URL}/meeting/${meetingId}`, {
    withCredentials: true,
  });
  return response.data;
};

export const castVote = async (pollId, optionIds) => {
  const response = await axios.post(
    `${API_URL}/${pollId}/vote`,
    { optionIds },
    { withCredentials: true },
  );
  return response.data;
};

export const closePoll = async (pollId) => {
  const response = await axios.patch(
    `${API_URL}/${pollId}/close`,
    {},
    { withCredentials: true },
  );
  return response.data;
};

export const deletePoll = async (pollId) => {
  const response = await axios.delete(`${API_URL}/${pollId}`, {
    withCredentials: true,
  });
  return response.data;
};
