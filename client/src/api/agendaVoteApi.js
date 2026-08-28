import api from "../services/apiClient";

export const getVoteTally = async (meetingId) => {
  const response = await api.get(`/api/meetings/${meetingId}/agenda-votes`);
  return response.data;
};

export const castVote = async (meetingId, agendaItemId, vote) => {
  const response = await api.post(
    `/api/meetings/${meetingId}/agenda-votes/${agendaItemId}`,
    { vote },
  );
  return response.data;
};

export const removeVote = async (meetingId, agendaItemId) => {
  const response = await api.delete(
    `/api/meetings/${meetingId}/agenda-votes/${agendaItemId}`,
  );
  return response.data;
};

export const autoSortAgenda = async (meetingId) => {
  const response = await api.post(
    `/api/meetings/${meetingId}/agenda-votes/auto-sort`,
  );
  return response.data;
};
