import { useState, useEffect, useCallback } from "react";
import { absenteeCatchUpApi } from "../api/absenteeCatchUpApi";

export const useAbsenteeCatchUp = () => {
  const [catchUps, setCatchUps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchCatchUps = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await absenteeCatchUpApi.getPendingCatchUps();
      setCatchUps(data.catchUps || []);
    } catch (error) {
      console.error("Failed to fetch catch-ups", error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatchUps();
  }, [fetchCatchUps]);

  const markAsRead = async (id) => {
    try {
      await absenteeCatchUpApi.markAsRead(id);
      fetchCatchUps();
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const deliverCatchUp = async (id) => {
    try {
      await absenteeCatchUpApi.deliverCatchUp(id);
      fetchCatchUps();
    } catch (error) {
      console.error("Failed to deliver", error);
    }
  };

  return {
    catchUps,
    isLoading,
    isError,
    markAsRead,
    deliverCatchUp,
  };
};
