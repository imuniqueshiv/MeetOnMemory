import apiClient from '../services/apiClient'
export const customFieldApi = {
  getDefinitions: async (orgId) => {
    const res = await apiClient.get(`/api/custom-fields/org/${orgId}`)
    return res.data
  },

  createDefinition: async (orgId, data) => {
    const res = await apiClient.post(`/api/custom-fields/org/${orgId}`, data)
    return res.data
  },

  updateDefinition: async (orgId, id, data) => {
    const res = await apiClient.put(`/api/custom-fields/org/${orgId}/definition/${id}`, data)
    return res.data
  },

  deleteDefinition: async (orgId, id) => {
    const res = await apiClient.delete(`/api/custom-fields/org/${orgId}/definition/${id}`)
    return res.data
  },

  getMeetingFields: async (meetingId) => {
    const res = await apiClient.get(`/api/custom-fields/meeting/${meetingId}`)
    return res.data
  },

  setMeetingFields: async (meetingId, orgId, fields) => {
    const res = await apiClient.post(`/api/custom-fields/meeting/${meetingId}`, {
      orgId,
      fields,
    })
    return res.data
  },
}
