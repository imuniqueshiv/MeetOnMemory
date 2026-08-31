import { useState, useEffect, useCallback } from "react";
import * as minutesApprovalApi from "../services/minutesApprovalApi";
import { toast } from "react-toastify";

const useMinutesApproval = (meetingId) => {
  const [approvalDoc, setApprovalDoc] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState("not_submitted");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApprovalStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await minutesApprovalApi.getApprovalStatus(meetingId);
      if (res && res.data && res.data.success) {
        setApprovalDoc(res.data.data || null);
        setApprovalStatus(res.data.status || "not_submitted");
      }
    } catch (err) {
      console.error("Failed to fetch approval status:", err);
      setError("Failed to load approval status");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (meetingId) {
      fetchApprovalStatus();
    }
  }, [meetingId, fetchApprovalStatus]);

  const submitApproval = async (snapshotSummary, approvers) => {
    try {
      const res = await minutesApprovalApi.submitApproval(
        meetingId,
        snapshotSummary,
        approvers,
      );
      if (res && res.data && res.data.success) {
        setApprovalDoc(res.data.data);
        setApprovalStatus(res.data.data?.status || "pending");
        toast.success("Minutes submitted for approval");
        return true;
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to submit for approval",
      );
      return false;
    }
  };

  const respondApproval = async (status, comment) => {
    try {
      const res = await minutesApprovalApi.respondApproval(
        meetingId,
        status,
        comment,
      );
      if (res && res.data && res.data.success) {
        setApprovalDoc(res.data.data);
        setApprovalStatus(res.data.data?.status || status);
        toast.success(`Minutes ${status} successfully`);
        return true;
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to respond to approval",
      );
      return false;
    }
  };

  return {
    approvalDoc,
    approvalStatus,
    loading,
    error,
    submitApproval,
    respondApproval,
    refreshApproval: fetchApprovalStatus,
  };
};

export default useMinutesApproval;
