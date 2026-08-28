import axios from "axios";

const API_BASE_URL = "/api";

/**
 * Fetch participant contributions for a given meeting
 * @param {string} meetingId
 */
export const getMeetingContributions = async (meetingId) => {
  const response = await axios.get(
    `${API_BASE_URL}/meetings/${meetingId}/contributions`,
    {
      withCredentials: true,
    },
  );
  return response.data;
};

/**
 * Manually trigger calculation of participant contributions for a given meeting
 * @param {string} meetingId
 */
export const calculateMeetingContributions = async (meetingId) => {
  const response = await axios.post(
    `${API_BASE_URL}/meetings/${meetingId}/contributions/calculate`,
    {},
    {
      withCredentials: true,
    },
  );
  return response.data;
};
