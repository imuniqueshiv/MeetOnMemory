import { useState, useCallback, useRef } from "react";
import { effectivenessApi } from "../services/effectivenessApi";

export const useEffectivenessScore = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [meetingScore, setMeetingScore] = useState(null);
  const [orgTrends, setOrgTrends] = useState([]);
  const [seriesTrends, setSeriesTrends] = useState([]);

  // Active requests counter to manage aggregate loading state safely
  const activeRequestsRef = useRef(0);

  const startLoading = () => {
    activeRequestsRef.current += 1;
    setLoading(true);
  };

  const stopLoading = () => {
    activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
    if (activeRequestsRef.current === 0) {
      setLoading(false);
    }
  };

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchMeetingScore = useCallback(async (meetingId) => {
    if (!meetingId) {
      setMeetingScore(null);
      return;
    }
    startLoading();
    setError(null);
    try {
      const data = await effectivenessApi.getMeetingScore(meetingId);
      if (data?.success) {
        setMeetingScore(data.data || null);
      } else {
        setMeetingScore(null);
        setError(data?.message || "Failed to fetch meeting score");
      }
    } catch (err) {
      setMeetingScore(null);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to fetch meeting score",
      );
    } finally {
      stopLoading();
    }
  }, []);

  const calculateScore = useCallback(
    async (meetingId, organizationId, seriesId) => {
      if (!meetingId) {
        setError("Meeting ID is required to calculate score");
        return;
      }
      startLoading();
      setError(null);
      try {
        const data = await effectivenessApi.calculateMeetingScore(
          meetingId,
          organizationId,
          seriesId,
        );
        if (data?.success) {
          setMeetingScore(data.data || null);
        } else {
          setError(data?.message || "Failed to calculate score");
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to calculate score",
        );
      } finally {
        stopLoading();
      }
    },
    [],
  );

  const fetchOrgTrends = useCallback(async (organizationId, days = 30) => {
    if (!organizationId) {
      setOrgTrends([]);
      return;
    }
    startLoading();
    try {
      const data = await effectivenessApi.getOrganizationTrends(
        organizationId,
        days,
      );
      if (data?.success) {
        setOrgTrends(Array.isArray(data.data) ? data.data : []);
      } else {
        setOrgTrends([]);
      }
    } catch (err) {
      setOrgTrends([]);
      // Log soft error or set error if critical
      console.warn("Failed to fetch organization trends:", err.message);
    } finally {
      stopLoading();
    }
  }, []);

  const fetchSeriesTrends = useCallback(async (seriesId, limit = 10) => {
    if (!seriesId) {
      setSeriesTrends([]);
      return;
    }
    startLoading();
    try {
      const data = await effectivenessApi.getSeriesTrends(seriesId, limit);
      if (data?.success) {
        setSeriesTrends(Array.isArray(data.data) ? data.data : []);
      } else {
        setSeriesTrends([]);
      }
    } catch (err) {
      setSeriesTrends([]);
      console.warn("Failed to fetch series trends:", err.message);
    } finally {
      stopLoading();
    }
  }, []);

  return {
    loading,
    error,
    meetingScore,
    orgTrends,
    seriesTrends,
    fetchMeetingScore,
    calculateScore,
    fetchOrgTrends,
    fetchSeriesTrends,
    clearError,
  };
};
