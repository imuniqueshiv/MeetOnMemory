import apiClient from "../services/apiClient";

const detectDuplicates = async (meetingId) => {
  return apiClient.get(`/api/meetings/${meetingId}/duplicates`);
};

const mergeMeetings = async (primaryId, secondaryId, fieldSelections = {}) => {
  return apiClient.post(`/api/meetings/${primaryId}/duplicates/merge`, {
    secondaryId,
    fieldSelections,
  });
};

const dismissDuplicate = async (primaryId, secondaryId) => {
  return apiClient.post(`/api/meetings/${primaryId}/duplicates`, {
    secondaryId,
  });
};

export const meetingDuplicateApi = {
  detectDuplicates,
  mergeMeetings,
  dismissDuplicate,
};
