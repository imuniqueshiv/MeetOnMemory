import { useState, useEffect } from "react";
import {
  getDashboardData,
  getOrphanedTopics,
  getCoOccurrenceGraph,
  generateBriefing,
  pinTopic,
  hideTopic,
  mergeTopics,
} from "../api/topicIntelligenceApi";

const useFetchData = (fetchFn, dependency) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refetch = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const result = await fetchFn(dependency);
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [fetchFn, refreshTrigger, dependency]);

  return { data, isLoading, error, refetch };
};

export const useTopicDashboard = (includeHidden) =>
  useFetchData(getDashboardData, includeHidden);

export const useOrphanedTopics = () => useFetchData(getOrphanedTopics);

export const useCoOccurrenceGraph = (includeHidden) =>
  useFetchData(getCoOccurrenceGraph, includeHidden);

export const useGenerateBriefing = () => {
  const [isPending, setIsPending] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const mutate = async (clusterId, options = {}) => {
    try {
      setIsPending(true);
      const result = await generateBriefing(clusterId);
      setData(result);
      if (options.onSuccess) {
        options.onSuccess(result, clusterId);
      }
    } catch (err) {
      setError(err);
      if (options.onError) {
        options.onError(err, clusterId);
      }
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending, data, error };
};

export const usePinTopic = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async ({ clusterId, isPinned }, options = {}) => {
    try {
      setIsPending(true);
      const result = await pinTopic(clusterId, isPinned);
      if (options.onSuccess) options.onSuccess(result);
    } catch (err) {
      setError(err);
      if (options.onError) options.onError(err);
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending, error };
};

export const useHideTopic = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async ({ clusterId, isHidden }, options = {}) => {
    try {
      setIsPending(true);
      const result = await hideTopic(clusterId, isHidden);
      if (options.onSuccess) options.onSuccess(result);
    } catch (err) {
      setError(err);
      if (options.onError) options.onError(err);
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending, error };
};

export const useMergeTopics = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async ({ sourceClusterId, targetClusterId }, options = {}) => {
    try {
      setIsPending(true);
      const result = await mergeTopics(sourceClusterId, targetClusterId);
      if (options.onSuccess) options.onSuccess(result);
    } catch (err) {
      setError(err);
      if (options.onError) options.onError(err);
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending, error };
};
