import { useState, useEffect, useCallback } from "react";
import api from "../utils/api.js"; // Or whatever fetch wrapper is used

export const useDecisionImpact = (decisionId) => {
  const [impactData, setImpactData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchImpact = useCallback(async () => {
    if (!decisionId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/decisions/${decisionId}/impact`);
      setImpactData(response.data);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || err.message);
      }
      setImpactData(null);
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  useEffect(() => {
    fetchImpact();
  }, [fetchImpact]);

  const updateImpact = async (updates) => {
    try {
      const response = await api.put(
        `/api/decisions/${decisionId}/impact`,
        updates,
      );
      setImpactData(response.data);
      return response.data;
    } catch (err) {
      throw err.response?.data?.message || err.message;
    }
  };

  return { impactData, loading, error, updateImpact, refresh: fetchImpact };
};

export const useDecisionImpactReport = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/decisions/impact/report`);
        setReportData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  return { reportData, loading, error };
};
