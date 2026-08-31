import { useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  requestToShadow,
  approveShadowRequest,
  denyShadowRequest,
  getPendingShadowRequests,
} from "../services/observerApi.js";

export const useObservers = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);

  const fetchPendingRequests = useCallback(async (meetingId) => {
    try {
      const data = await getPendingShadowRequests(meetingId);
      setPendingRequests(data.pendingObservers || []);
    } catch (error) {
      console.error("Failed to fetch pending requests:", error);
    }
  }, []);

  const shadowRequest = useCallback(async (meetingId) => {
    setIsLoading(true);
    try {
      await requestToShadow(meetingId);
      toast.success("Shadow request sent successfully.");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send shadow request.",
      );
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleShadowRequest = useCallback(async (meetingId, userId, action) => {
    setIsLoading(true);
    try {
      if (action === "approve") {
        await approveShadowRequest(meetingId, userId);
        toast.success("Shadow request approved.");
      } else {
        await denyShadowRequest(meetingId, userId);
        toast.info("Shadow request denied.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || `Failed to ${action} shadow request.`,
      );
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    pendingRequests,
    fetchPendingRequests,
    shadowRequest,
    handleShadowRequest,
  };
};

export default useObservers;
