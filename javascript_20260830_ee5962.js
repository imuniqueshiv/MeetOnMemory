import { useState, useEffect, useCallback } from 'react';
import IcebreakerApi from '../api/IcebreakerApi';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Custom hook for managing icebreaker state and operations
 */
export const useIcebreaker = (meetingId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIcebreaker, setActiveIcebreaker] = useState(null);
  const [history, setHistory] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [stats, setStats] = useState(null);
  const [socket, setSocket] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    if (!meetingId) return;

    const newSocket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    setSocket(newSocket);

    // Join icebreaker room
    newSocket.emit('icebreaker:join', { meetingId });

    // Listen for events
    newSocket.on('icebreaker:generated', (data) => {
      setActiveIcebreaker(data);
      fetchHistory();
    });

    newSocket.on('icebreaker:selected', (data) => {
      setActiveIcebreaker(data);
    });

    newSocket.on('icebreaker:response', (data) => {
      // Update response count without full refresh
      setActiveIcebreaker((prev) => {
        if (prev && prev._id === data.icebreakerId) {
          return {
            ...prev,
            responseCount: data.responseCount,
          };
        }
        return prev;
      });
    });

    newSocket.on('icebreaker:user_joined', (data) => {
      setParticipants((prev) => [...prev, data.userId]);
    });

    return () => {
      newSocket.emit('icebreaker:leave', { meetingId });
      newSocket.disconnect();
    };
  }, [meetingId]);

  // Fetch active icebreaker on mount
  useEffect(() => {
    if (meetingId) {
      fetchActiveIcebreaker();
      fetchHistory();
      fetchAvailableTypes();
    }
  }, [meetingId]);

  /**
   * Fetch active icebreaker
   */
  const fetchActiveIcebreaker = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await IcebreakerApi.getActiveIcebreaker(meetingId);
      if (response.success && response.data) {
        setActiveIcebreaker(response.data);
      } else if (response.notFound) {
        setActiveIcebreaker(null);
      }
    } catch (err) {
      setError(err.error || 'Failed to fetch active icebreaker');
      setActiveIcebreaker(null);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  /**
   * Fetch meeting history
   */
  const fetchHistory = useCallback(async () => {
    try {
      const response = await IcebreakerApi.getMeetingHistory(meetingId, { limit: 20 });
      if (response.success) {
        setHistory(response.data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch history:', err);
    }
  }, [meetingId]);

  /**
   * Fetch available types
   */
  const fetchAvailableTypes = useCallback(async () => {
    try {
      const response = await IcebreakerApi.getAvailableTypes();
      if (response.success) {
        setAvailableTypes(response.data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch types:', err);
    }
  }, []);

  /**
   * Generate a new icebreaker
   */
  const generateIcebreaker = useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await IcebreakerApi.generateIcebreaker(meetingId, options);
      if (response.success) {
        await fetchActiveIcebreaker();
        await fetchHistory();
        return response.data;
      }
    } catch (err) {
      setError(err.error || 'Failed to generate icebreaker');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [meetingId, fetchActiveIcebreaker, fetchHistory]);

  /**
   * Select an icebreaker
   */
  const selectIcebreaker = useCallback(async (icebreakerId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await IcebreakerApi.selectIcebreaker(icebreakerId, meetingId);
      if (response.success) {
        setActiveIcebreaker(response.data);
        await fetchHistory();
        return response.data;
      }
    } catch (err) {
      setError(err.error || 'Failed to select icebreaker');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [meetingId, fetchHistory]);

  /**
   * Submit a response
   */
  const submitResponse = useCallback(async (icebreakerId, answer) => {
    setLoading(true);
    setError(null);
    try {
      const response = await IcebreakerApi.submitResponse(icebreakerId, answer);
      if (response.success) {
        await fetchActiveIcebreaker();
        return response.data;
      }
    } catch (err) {
      setError(err.error || 'Failed to submit response');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchActiveIcebreaker]);

  /**
   * Auto-schedule icebreakers
   */
  const autoSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await IcebreakerApi.autoScheduleIcebreakers(meetingId);
      if (response.success) {
        await fetchHistory();
        return response.data;
      }
    } catch (err) {
      setError(err.error || 'Failed to auto-schedule');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [meetingId, fetchHistory]);

  /**
   * Get response summary
   */
  const getSummary = useCallback(async (icebreakerId) => {
    try {
      const response = await IcebreakerApi.getResponseSummary(icebreakerId);
      if (response.success) {
        return response.data;
      }
    } catch (err) {
      console.warn('Failed to get summary:', err);
      return null;
    }
  }, []);

  return {
    // State
    loading,
    error,
    activeIcebreaker,
    history,
    availableTypes,
    participants,
    stats,

    // Actions
    generateIcebreaker,
    selectIcebreaker,
    submitResponse,
    fetchActiveIcebreaker,
    fetchHistory,
    autoSchedule,
    getSummary,

    // Helpers
    hasActiveIcebreaker: !!activeIcebreaker,
    isParticipating: participants.length > 0,
    hasResponded: activeIcebreaker?.responses?.some?.(
      (r) => r.userId === localStorage.getItem('userId')
    ),
  };
};

export default useIcebreaker;