import api from './api';

export const okrService = {
    createOkr: async (okrData) => {
        const response = await api.post('/api/okrs', okrData);
        return response.data;
    },

    getOkrs: async (params) => {
        const response = await api.get('/api/okrs', { params });
        return response.data;
    },

    getOkr: async (id) => {
        const response = await api.get(`/api/okrs/${id}`);
        return response.data;
    },

    updateKeyResults: async (id, keyResults) => {
        const response = await api.put(`/api/okrs/${id}/key-results`, { keyResults });
        return response.data;
    },

    linkMeeting: async (id, meetingId) => {
        const response = await api.post(`/api/okrs/${id}/link-meeting`, { meetingId });
        return response.data;
    },

    getOkrAnalytics: async () => {
        const response = await api.get('/api/okrs/analytics/dashboard');
        return response.data;
    }
};
