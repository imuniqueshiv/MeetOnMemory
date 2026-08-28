import { useState, useEffect } from "react";
import {
  fetchChangeLogs,
  fetchChangeLogStats,
} from "../api/actionItemChangeLogApi";

export const useActionItemChangeLogs = (actionItemId, params = {}) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const paramsString = JSON.stringify(params);

  useEffect(() => {
    if (!actionItemId) return;

    let isMounted = true;
    setIsLoading(true);

    const parsedParams = JSON.parse(paramsString);

    fetchChangeLogs(actionItemId, parsedParams)
      .then((res) => {
        if (isMounted) setData(res);
      })
      .catch((err) => {
        if (isMounted) setError(err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [actionItemId, paramsString]);

  return { data, isLoading, error };
};

export const useActionItemChangeLogStats = (actionItemId) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!actionItemId) return;

    let isMounted = true;
    setIsLoading(true);

    fetchChangeLogStats(actionItemId)
      .then((res) => {
        if (isMounted) setData(res);
      })
      .catch((err) => {
        if (isMounted) setError(err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [actionItemId]);

  return { data, isLoading, error };
};
