import apiClient from "../services/apiClient";

/**
 * Fetch participant contributions for a given meeting
 * @param {string} meetingId
 */
export const getMeetingContributions = async (meetingId) => {
  const response = await apiClient.get(
    `/api/meetings/${meetingId}/contributions`,
  );
  return response.data;
};

/**
 * Manually trigger calculation of participant contributions for a given meeting
 * @param {string} meetingId
 */
export const calculateMeetingContributions = async (meetingId) => {
  const response = await apiClient.post(
    `/api/meetings/${meetingId}/contributions/calculate`,
    {},
    
  );
  return response.data;
};
