import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_PREFIX = '/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('clerk_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      // Log specific error types
      if (status === 401) {
        console.warn('Authentication required for icebreaker API');
      } else if (status === 403) {
        console.warn('Insufficient permissions for icebreaker API');
      } else if (status === 404) {
        // Distinguishable 404 for icebreaker resources
        const isIcebreakerNotFound = data?.error?.includes('icebreaker');
        if (isIcebreakerNotFound) {
          console.info('Icebreaker resource not found');
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Icebreaker API service
 */
const IcebreakerApi = {
  /**
   * Generate a new icebreaker for a meeting
   */
  generateIcebreaker: async (meetingId, options = {}) => {
    try {
      const response = await api.post(`/icebreakers/meeting/${meetingId}/generate`, options);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to generate icebreaker' };
    }
  },

  /**
   * Select and activate an icebreaker
   */
  selectIcebreaker: async (icebreakerId, meetingId) => {
    try {
      const response = await api.post(`/icebreakers/${icebreakerId}/select`, { meetingId });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to select icebreaker' };
    }
  },

  /**
   * Get active icebreaker for a meeting
   */
  getActiveIcebreaker: async (meetingId) => {
    try {
      const response = await api.get(`/icebreakers/meeting/${meetingId}/active`);
      return response.data;
    } catch (error) {
      // Distinguishable 404 handling
      if (error.response?.status === 404) {
        return { success: false, error: 'No active icebreaker found', notFound: true };
      }
      throw error.response?.data || { error: 'Failed to get active icebreaker' };
    }
  },

  /**
   * Submit a response to an icebreaker
   */
  submitResponse: async (icebreakerId, answer) => {
    try {
      const response = await api.post(`/icebreakers/${icebreakerId}/respond`, { answer });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to submit response' };
    }
  },

  /**
   * Get meeting icebreaker history
   */
  getMeetingHistory: async (meetingId, options = {}) => {
    try {
      const { limit = 10, status } = options;
      const params = new URLSearchParams({ limit: String(limit) });
      if (status) params.append('status', status);
      
      const response = await api.get(`/icebreakers/meeting/${meetingId}/history?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to get meeting history' };
    }
  },

  /**
   * Get organization statistics
   */
  getOrganizationStats: async (options = {}) => {
    try {
      const { startDate, endDate } = options;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await api.get(`/icebreakers/stats/organization?${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to get organization stats' };
    }
  },

  /**
   * Get available icebreaker types
   */
  getAvailableTypes: async () => {
    try {
      const response = await api.get('/icebreakers/types');
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to get available types' };
    }
  },

  /**
   * Auto-schedule icebreakers for a meeting
   */
  autoScheduleIcebreakers: async (meetingId) => {
    try {
      const response = await api.post(`/icebreakers/meeting/${meetingId}/auto-schedule`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to auto-schedule icebreakers' };
    }
  },

  /**
   * Get response summary for an icebreaker
   */
  getResponseSummary: async (icebreakerId) => {
    try {
      const response = await api.get(`/icebreakers/${icebreakerId}/summary`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to get response summary' };
    }
  },

  /**
   * Delete an icebreaker
   */
  deleteIcebreaker: async (icebreakerId) => {
    try {
      const response = await api.delete(`/icebreakers/${icebreakerId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to delete icebreaker' };
    }
  },
};

export default IcebreakerApi;