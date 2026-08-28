import api from "./apiClient";

export const getProposals = async (meetingId) => {
  const response = await api.get(
    `/api/meetings/${meetingId}/agenda-builder/proposals`,
  );
  return response.data;
};

export const createProposal = async (meetingId, data) => {
  const response = await api.post(
    `/api/meetings/${meetingId}/agenda-builder/proposals`,
    data,
  );
  return response.data;
};

export const voteProposal = async (meetingId, proposalId, voteValue) => {
  const response = await api.post(
    `/api/meetings/${meetingId}/agenda-builder/proposals/${proposalId}/vote`,
    { voteValue },
  );
  return response.data;
};

export const updateProposalStatus = async (meetingId, proposalId, status) => {
  const response = await api.put(
    `/api/meetings/${meetingId}/agenda-builder/proposals/${proposalId}/status`,
    { status },
  );
  return response.data;
};

export const reorderProposals = async (meetingId, orderedIds) => {
  const response = await api.put(
    `/api/meetings/${meetingId}/agenda-builder/proposals/reorder`,
    { orderedIds },
  );
  return response.data;
};

export const generateAiProposals = async (meetingId, contextData) => {
  const response = await api.post(
    `/api/meetings/${meetingId}/agenda-builder/ai-suggest`,
    { contextData },
  );
  return response.data;
};

export const finalizeAgenda = async (meetingId) => {
  const response = await api.post(
    `/api/meetings/${meetingId}/agenda-builder/finalize`,
  );
  return response.data;
};
