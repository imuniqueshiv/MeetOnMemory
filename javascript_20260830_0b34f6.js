import { useState, useEffect, useCallback } from 'react';
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

/**
 * Custom hook for managing meeting attendance
 * FIXED: Now uses /api prefix for all endpoints
 */
export const useMeetingAttendance = (meetingId) => {
  const [attendance, setAttendance] = useState({
    participants: [],
    present: [],
    absent: [],
    excused: [],
    pending: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    excused: 0,
    attendanceRate: 0,
  });

  /**
   * Fetch attendance for a meeting
   * GET /api/meetings/:meetingId/attendance
   */
  const fetchAttendance = useCallback(async () => {
    if (!meetingId) {
      setError('Meeting ID is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/meetings/${meetingId}/attendance`);
      
      if (response.data.success) {
        const data = response.data.data;
        setAttendance({
          participants: data.participants || [],
          present: data.present || [],
          absent: data.absent || [],
          excused: data.excused || [],
          pending: data.pending || [],
        });
        
        // Calculate stats
        const total = data.participants?.length || 0;
        const present = data.present?.length || 0;
        const absent = data.absent?.length || 0;
        const excused = data.excused?.length || 0;
        
        setStats({
          total,
          present,
          absent,
          excused,
          attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
        });
      } else {
        throw new Error(response.data.error || 'Failed to fetch attendance');
      }
    } catch (err) {
      // Distinguishable 404 vs other errors
      if (err.response?.status === 404) {
        setError('No attendance records found for this meeting');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to fetch attendance');
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  /**
   * Mark a participant as present
   * POST /api/meetings/:meetingId/attendance/present
   */
  const markPresent = useCallback(async (userId) => {
    if (!meetingId || !userId) {
      setError('Meeting ID and User ID are required');
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/meetings/${meetingId}/attendance/present`, {
        userId,
        timestamp: new Date().toISOString(),
      });

      if (response.data.success) {
        await fetchAttendance();
        return true;
      }
      throw new Error(response.data.error || 'Failed to mark present');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to mark present');
      return false;
    } finally {
      setLoading(false);
    }
  }, [meetingId, fetchAttendance]);

  /**
   * Mark a participant as absent
   * POST /api/meetings/:meetingId/attendance/absent
   */
  const markAbsent = useCallback(async (userId, reason = '') => {
    if (!meetingId || !userId) {
      setError('Meeting ID and User ID are required');
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/meetings/${meetingId}/attendance/absent`, {
        userId,
        reason,
        timestamp: new Date().toISOString(),
      });

      if (response.data.success) {
        await fetchAttendance();
        return true;
      }
      throw new Error(response.data.error || 'Failed to mark absent');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to mark absent');
      return false;
    } finally {
      setLoading(false);
    }
  }, [meetingId, fetchAttendance]);

  /**
   * Mark a participant as excused
   * POST /api/meetings/:meetingId/attendance/excused
   */
  const markExcused = useCallback(async (userId, reason = '') => {
    if (!meetingId || !userId) {
      setError('Meeting ID and User ID are required');
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/meetings/${meetingId}/attendance/excused`, {
        userId,
        reason,
        timestamp: new Date().toISOString(),
      });

      if (response.data.success) {
        await fetchAttendance();
        return true;
      }
      throw new Error(response.data.error || 'Failed to mark excused');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to mark excused');
      return false;
    } finally {
      setLoading(false);
    }
  }, [meetingId, fetchAttendance]);

  /**
   * Bulk update attendance
   * POST /api/meetings/:meetingId/attendance/bulk
   */
  const bulkUpdate = useCallback(async (updates) => {
    if (!meetingId || !updates || !Array.isArray(updates)) {
      setError('Meeting ID and updates array are required');
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/meetings/${meetingId}/attendance/bulk`, {
        updates,
        timestamp: new Date().toISOString(),
      });

      if (response.data.success) {
        await fetchAttendance();
        return true;
      }
      throw new Error(response.data.error || 'Failed to update attendance');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update attendance');
      return false;
    } finally {
      setLoading(false);
    }
  }, [meetingId, fetchAttendance]);

  /**
   * Get attendance summary for a date range
   * GET /api/meetings/:meetingId/attendance/summary
   */
  const getAttendanceSummary = useCallback(async (startDate, endDate) => {
    if (!meetingId) {
      setError('Meeting ID is required');
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(
        `/meetings/${meetingId}/attendance/summary?${params}`
      );

      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to get summary');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to get summary');
      return null;
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  /**
   * Export attendance report
   * GET /api/meetings/:meetingId/attendance/export
   */
  const exportAttendance = useCallback(async (format = 'csv') => {
    if (!meetingId) {
      setError('Meeting ID is required');
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.get(
        `/meetings/${meetingId}/attendance/export`,
        {
          params: { format },
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${meetingId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return true;
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to export');
      return false;
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  // Auto-fetch on mount and when meetingId changes
  useEffect(() => {
    if (meetingId) {
      fetchAttendance();
    }
  }, [meetingId, fetchAttendance]);

  return {
    // State
    attendance,
    stats,
    loading,
    error,
    
    // Actions
    fetchAttendance,
    markPresent,
    markAbsent,
    markExcused,
    bulkUpdate,
    getAttendanceSummary,
    exportAttendance,
    
    // Helpers
    isPresent: (userId) => attendance.present.some(p => p._id === userId || p === userId),
    isAbsent: (userId) => attendance.absent.some(p => p._id === userId || p === userId),
    isExcused: (userId) => attendance.excused.some(p => p._id === userId || p === userId),
    isPending: (userId) => attendance.pending.some(p => p._id === userId || p === userId),
  };
};

export default useMeetingAttendance;