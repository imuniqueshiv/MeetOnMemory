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
        console.warn('Debrief Q&A resource not found:', data);
      } else if (status === 401) {
        console.warn('Authentication required for debrief Q&A');
      } else if (status === 403) {
        console.warn('Insufficient permissions for debrief Q&A');
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Debrief Q&A API Service
 * FIXED: Now uses /api prefix for all endpoints
 */
const debriefQAApi = {
  /**
   * Get all Q&A sessions for a debrief
   * GET /api/debrief/session/:debriefId/qa
   */
  getSessions: async (debriefId) => {
    try {
      const response = await api.get(`/debrief/session/${debriefId}/qa`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to fetch Q&A sessions' };
    }
  },

  /**
   * Create a new Q&A session
   * POST /api/debrief/session/:debriefId/qa
   */
  createSession: async (debriefId, data) => {
    try {
      const response = await api.post(`/debrief/session/${debriefId}/qa`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to create Q&A session' };
    }
  },

  /**
   * Get a specific Q&A session
   * GET /api/debrief/session/:debriefId/qa/:sessionId
   */
  getSession: async (debriefId, sessionId) => {
    try {
      const response = await api.get(`/debrief/session/${debriefId}/qa/${sessionId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to fetch Q&A session' };
    }
  },

  /**
   * Update a Q&A session
   * PUT /api/debrief/session/:debriefId/qa/:sessionId
   */
  updateSession: async (debriefId, sessionId, data) => {
    try {
      const response = await api.put(`/debrief/session/${debriefId}/qa/${sessionId}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to update Q&A session' };
    }
  },

  /**
   * Delete a Q&A session
   * DELETE /api/debrief/session/:debriefId/qa/:sessionId
   */
  deleteSession: async (debriefId, sessionId) => {
    try {
      const response = await api.delete(`/debrief/session/${debriefId}/qa/${sessionId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to delete Q&A session' };
    }
  },

  /**
   * Add a question to a session
   * POST /api/debrief/session/:debriefId/qa/:sessionId/questions
   */
  addQuestion: async (debriefId, sessionId, questionData) => {
    try {
      const response = await api.post(
        `/debrief/session/${debriefId}/qa/${sessionId}/questions`,
        questionData
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to add question' };
    }
  },

  /**
   * Update a question
   * PUT /api/debrief/session/:debriefId/qa/:sessionId/questions/:questionId
   */
  updateQuestion: async (debriefId, sessionId, questionId, data) => {
    try {
      const response = await api.put(
        `/debrief/session/${debriefId}/qa/${sessionId}/questions/${questionId}`,
        data
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to update question' };
    }
  },

  /**
   * Delete a question
   * DELETE /api/debrief/session/:debriefId/qa/:sessionId/questions/:questionId
   */
  deleteQuestion: async (debriefId, sessionId, questionId) => {
    try {
      const response = await api.delete(
        `/debrief/session/${debriefId}/qa/${sessionId}/questions/${questionId}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to delete question' };
    }
  },

  /**
   * Add an answer to a question
   * POST /api/debrief/session/:debriefId/qa/:sessionId/questions/:questionId/answers
   */
  addAnswer: async (debriefId, sessionId, questionId, answerData) => {
    try {
      const response = await api.post(
        `/debrief/session/${debriefId}/qa/${sessionId}/questions/${questionId}/answers`,
        answerData
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to add answer' };
    }
  },

  /**
   * Update an answer
   * PUT /api/debrief/session/:debriefId/qa/:sessionId/questions/:questionId/answers/:answerId
   */
  updateAnswer: async (debriefId, sessionId, questionId, answerId, data) => {
    try {
      const response = await api.put(
        `/debrief/session/${debriefId}/qa/${sessionId}/questions/${questionId}/answers/${answerId}`,
        data
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to update answer' };
    }
  },

  /**
   * Delete an answer
   * DELETE /api/debrief/session/:debriefId/qa/:sessionId/questions/:questionId/answers/:answerId
   */
  deleteAnswer: async (debriefId, sessionId, questionId, answerId) => {
    try {
      const response = await api.delete(
        `/debrief/session/${debriefId}/qa/${sessionId}/questions/${questionId}/answers/${answerId}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to delete answer' };
    }
  },

  /**
   * Vote on a question
   * POST /api/debrief/session/:debriefId/qa/:sessionId/questions/:questionId/vote
   */
  voteQuestion: async (debriefId, sessionId, questionId, voteType = 'up') => {
    try {
      const response = await api.post(
        `/debrief/session/${debriefId}/qa/${sessionId}/questions/${questionId}/vote`,
        { voteType }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to vote on question' };
    }
  },

  /**
   * Get Q&A statistics for a debrief
   * GET /api/debrief/session/:debriefId/qa/stats
   */
  getStats: async (debriefId) => {
    try {
      const response = await api.get(`/debrief/session/${debriefId}/qa/stats`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to fetch Q&A stats' };
    }
  },

  /**
   * Export Q&A session
   * GET /api/debrief/session/:debriefId/qa/:sessionId/export
   */
  exportSession: async (debriefId, sessionId, format = 'pdf') => {
    try {
      const response = await api.get(
        `/debrief/session/${debriefId}/qa/${sessionId}/export`,
        {
          params: { format },
          responseType: 'blob',
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qa_session_${sessionId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return { success: true };
    } catch (error) {
      throw error.response?.data || { error: 'Failed to export session' };
    }
  },
};

export default debriefQAApi;