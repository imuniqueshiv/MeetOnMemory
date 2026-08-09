import api from "./apiClient";

const COMPARISON_URL = "/api/comparison";

// Compare two meetings
export const compareMeetings = async (meetingIdA, meetingIdB) => {
  const response = await api.post(`${COMPARISON_URL}/compare`, {
    meetingIdA,
    meetingIdB,
  });
  return response.data;
};

// Get a list of comparable meetings for a given meeting
export const getComparableMeetings = async (meetingId) => {
  const response = await api.get(`${COMPARISON_URL}/comparable/${meetingId}`);
  return response.data;
};
