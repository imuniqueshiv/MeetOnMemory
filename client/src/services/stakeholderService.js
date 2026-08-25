import api from './api';

export const stakeholderService = {
    createStakeholder: async (data) => {
        const response = await api.post('/api/stakeholders', data);
        return response.data;
    },

    getStakeholders: async (params) => {
        const response = await api.get('/api/stakeholders', { params });
        return response.data;
    },

    logInteraction: async (id, data) => {
        const response = await api.post(`/api/stakeholders/${id}/interactions`, data);
        return response.data;
    },

    updateStakeholder: async (id, data) => {
        const response = await api.put(`/api/stakeholders/${id}`, data);
        return response.data;
    },

    getAnalytics: async () => {
        const response = await api.get('/api/stakeholders/analytics/dashboard');
        return response.data;
    }
};
