import api from './api';

export const ipVaultService = {
    createIpIdea: async (data) => {
        const response = await api.post('/api/ip-vault', data);
        return response.data;
    },

    getIpIdeas: async (params) => {
        const response = await api.get('/api/ip-vault', { params });
        return response.data;
    },

    getIpAnalytics: async () => {
        const response = await api.get('/api/ip-vault/analytics/dashboard');
        return response.data;
    },

    updateIpIdea: async (id, data) => {
        const response = await api.put(`/api/ip-vault/${id}`, data);
        return response.data;
    }
};
