import api from './api';

export const stakeholderService = {
    createStakeholder: async (data) => (await api.post('/api/stakeholders', data)).data,
    getStakeholders: async (params) => (await api.get('/api/stakeholders', { params })).data,
    getStakeholder: async (id) => (await api.get(`/api/stakeholders/${id}`)).data,
    updateStakeholder: async (id, data) => (await api.put(`/api/stakeholders/${id}`, data)).data,
    deleteStakeholder: async (id) => (await api.delete(`/api/stakeholders/${id}`)).data,
    logInteraction: async (id, data) => (await api.post(`/api/stakeholders/${id}/interactions`, data)).data,
    getAnalytics: async () => (await api.get('/api/stakeholders/analytics/dashboard')).data
};
