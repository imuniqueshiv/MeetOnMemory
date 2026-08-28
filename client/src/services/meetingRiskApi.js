import api from "./apiClient";

const meetingRiskApi = {
  createRisk: async (data) => {
    const response = await api.post("/api/meeting-risks", data);
    return response.data;
  },

  getRisksByOrganization: async (organizationId) => {
    const response = await api.get(
      `/api/meeting-risks/organization/${organizationId}`,
    );
    return response.data;
  },

  getRisksByMeeting: async (meetingId) => {
    const response = await api.get(`/api/meeting-risks/meeting/${meetingId}`);
    return response.data;
  },

  updateRisk: async (riskId, data) => {
    const response = await api.put(`/api/meeting-risks/${riskId}`, data);
    return response.data;
  },

  deleteRisk: async (riskId) => {
    const response = await api.delete(`/api/meeting-risks/${riskId}`);
    return response.data;
  },

  linkActionItem: async (riskId, actionItemId) => {
    const response = await api.post(
      `/api/meeting-risks/${riskId}/action-items`,
      { actionItemId },
    );
    return response.data;
  },

  updateRiskStatus: async (riskId, data) => {
    const response = await api.patch(
      `/api/meeting-risks/${riskId}/status`,
      data,
    );
    return response.data;
  },

  exportRisks: async (organizationId, format = "csv") => {
    const response = await api.get(
      `/api/meeting-risks/organization/${organizationId}/export`,
      { params: { format }, responseType: "blob" },
    );
    return response.data;
  },
};

export default meetingRiskApi;
