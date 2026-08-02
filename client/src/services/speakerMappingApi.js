import api from "./apiClient";

export const speakerMappingApi = {
  getMappings: (meetingId) => api.get(`/speaker-mappings/${meetingId}`),

  suggestMappings: (meetingId) =>
    api.get(`/speaker-mappings/${meetingId}/suggest`),

  saveAndApplyMapping: (meetingId, originalLabel, mappedName) =>
    api.post(`/speaker-mappings/${meetingId}`, { originalLabel, mappedName }),

  revertMapping: (meetingId, mappingId) =>
    api.delete(`/speaker-mappings/${meetingId}/${mappingId}`),
};
