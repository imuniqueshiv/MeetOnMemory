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

const rollbackMerge = async (primaryId, mergeAuditId) => {
  return apiClient.post(
    `/api/meetings/${primaryId}/duplicates/rollback/${mergeAuditId}`,
  );
};

export const meetingDuplicateApi = {
  detectDuplicates,
  mergeMeetings,
  dismissDuplicate,
  rollbackMerge,
};
