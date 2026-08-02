import api from "./apiClient";

export const generateAgendaSuggestions = async (organizationId, meetingId) => {
  const response = await api.post("/agenda-suggestions/generate", {
    organizationId,
    meetingId,
  });
  return response.data;
};

export const updateSuggestionItemStatus = async (
  suggestionId,
  itemId,
  status,
  acceptedText,
) => {
  const response = await api.put(
    `/agenda-suggestions/${suggestionId}/item/${itemId}`,
    {
      status,
      acceptedText,
    },
  );
  return response.data;
};

export const applySuggestionToMeeting = async (suggestionId, meetingId) => {
  const response = await api.post(`/agenda-suggestions/${suggestionId}/apply`, {
    meetingId,
  });
  return response.data;
};

export const getMeetingSuggestions = async (meetingId) => {
  const response = await api.get(`/agenda-suggestions/meeting/${meetingId}`);
  return response.data;
};
