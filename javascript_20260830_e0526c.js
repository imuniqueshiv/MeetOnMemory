import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_PREFIX = '/api';

// Create axios instance with proper base URL
const api = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add auth interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('clerk_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 404) {
        console.info('Action item changelog not found:', data);
      } else if (status === 401) {
        console.warn('Authentication required for action item changelog');
      } else if (status === 403) {
        console.warn('Insufficient permissions for action item changelog');
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Action Item Change Log API Service
 * FIXED: Now uses /api prefix for all endpoints
 */
const actionItemChangeLogApi = {
  /**
   * Get changelog for an action item
   * GET /api/action-items/:actionItemId/changelog
   */
  getChangeLog: async (actionItemId, options = {}) => {
    try {
      const { limit = 50, offset = 0, startDate, endDate } = options;
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(
        `/action-items/${actionItemId}/changelog?${params}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to fetch changelog' };
    }
  },

  /**
   * Get a specific changelog entry
   * GET /api/action-items/:actionItemId/changelog/:entryId
   */
  getChangeLogEntry: async (actionItemId, entryId) => {
    try {
      const response = await api.get(
        `/action-items/${actionItemId}/changelog/${entryId}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to fetch changelog entry' };
    }
  },

  /**
   * Create a new changelog entry
   * POST /api/action-items/:actionItemId/changelog
   */
  createChangeLogEntry: async (actionItemId, data) => {
    try {
      const response = await api.post(
        `/action-items/${actionItemId}/changelog`,
        data
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to create changelog entry' };
    }
  },

  /**
   * Update a changelog entry
   * PUT /api/action-items/:actionItemId/changelog/:entryId
   */
  updateChangeLogEntry: async (actionItemId, entryId, data) => {
    try {
      const response = await api.put(
        `/action-items/${actionItemId}/changelog/${entryId}`,
        data
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to update changelog entry' };
    }
  },

  /**
   * Delete a changelog entry
   * DELETE /api/action-items/:actionItemId/changelog/:entryId
   */
  deleteChangeLogEntry: async (actionItemId, entryId) => {
    try {
      const response = await api.delete(
        `/action-items/${actionItemId}/changelog/${entryId}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to delete changelog entry' };
    }
  },

  /**
   * Get changelog summary for an action item
   * GET /api/action-items/:actionItemId/changelog/summary
   */
  getChangeLogSummary: async (actionItemId) => {
    try {
      const response = await api.get(
        `/action-items/${actionItemId}/changelog/summary`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to fetch changelog summary' };
    }
  },

  /**
   * Get changelog statistics
   * GET /api/action-items/:actionItemId/changelog/stats
   */
  getChangeLogStats: async (actionItemId) => {
    try {
      const response = await api.get(
        `/action-items/${actionItemId}/changelog/stats`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to fetch changelog stats' };
    }
  },

  /**
   * Compare two versions of an action item
   * GET /api/action-items/:actionItemId/changelog/compare
   */
  compareVersions: async (actionItemId, version1, version2) => {
    try {
      const response = await api.get(
        `/action-items/${actionItemId}/changelog/compare`,
        {
          params: { version1, version2 },
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to compare versions' };
    }
  },

  /**
   * Restore a previous version
   * POST /api/action-items/:actionItemId/changelog/restore
   */
  restoreVersion: async (actionItemId, versionId) => {
    try {
      const response = await api.post(
        `/action-items/${actionItemId}/changelog/restore`,
        { versionId }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to restore version' };
    }
  },

  /**
   * Get recent changes across all action items
   * GET /api/action-items/changelog/recent
   */
  getRecentChanges: async (options = {}) => {
    try {
      const { limit = 20, offset = 0 } = options;
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });

      const response = await api.get(
        `/action-items/changelog/recent?${params}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to fetch recent changes' };
    }
  },

  /**
   * Export changelog
   * GET /api/action-items/:actionItemId/changelog/export
   */
  exportChangeLog: async (actionItemId, format = 'csv') => {
    try {
      const response = await api.get(
        `/action-items/${actionItemId}/changelog/export`,
        {
          params: { format },
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `changelog_${actionItemId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      throw error.response?.data || { error: 'Failed to export changelog' };
    }
  },
};

export default actionItemChangeLogApi;