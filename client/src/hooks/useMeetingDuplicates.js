import { useState, useEffect, useCallback } from "react";
import { meetingDuplicateApi } from "../api/meetingDuplicateApi";
import { toast } from "react-toastify";

export const useMeetingDuplicates = (meetingId) => {
  const [duplicates, setDuplicates] = useState([]);
  const [recentMerges, setRecentMerges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const fetchDuplicates = useCallback(async () => {
    if (!meetingId) return;
    setIsLoading(true);
    setIsError(false);
    try {
      const response = await meetingDuplicateApi.detectDuplicates(meetingId);
      setDuplicates(response.data?.duplicates || []);
    } catch (err) {
      console.error(err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const mergeMeetings = async ({
    primaryId,
    secondaryId,
    fieldSelections = {},
  }) => {
    setIsMerging(true);
    try {
      const secondaryObj = duplicates.find((d) => d._id === secondaryId);
      const response = await meetingDuplicateApi.mergeMeetings(
        primaryId,
        secondaryId,
        fieldSelections,
      );
      toast.success("Meetings merged successfully");

      const mergeResult = response.data?.data || response.data || {};
      const auditId = mergeResult.mergeAuditId || mergeResult._id;
      if (auditId) {
        setRecentMerges((prev) => [
          {
            mergeAuditId: auditId,
            secondaryMeeting: secondaryObj || {
              _id: secondaryId,
              title: "Secondary Meeting",
            },
            fieldSelections,
            mergedAt: new Date(),
          },
          ...prev,
        ]);
      }

      setDuplicates((prev) => prev.filter((d) => d._id !== secondaryId));
      return response;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to merge meetings");
      throw error;
    } finally {
      setIsMerging(false);
    }
  };

  const rollbackMerge = async ({ primaryId, mergeAuditId }) => {
    setIsRollingBack(true);
    try {
      const response = await meetingDuplicateApi.rollbackMerge(
        primaryId,
        mergeAuditId,
      );
      toast.success("Merge rolled back successfully");
      setRecentMerges((prev) =>
        prev.filter((m) => m.mergeAuditId !== mergeAuditId),
      );
      await fetchDuplicates();
      return response;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to rollback merge");
      throw error;
    } finally {
      setIsRollingBack(false);
    }
  };

  const dismissDuplicate = async ({ primaryId, secondaryId }) => {
    setIsDismissing(true);
    try {
      await meetingDuplicateApi.dismissDuplicate(primaryId, secondaryId);
      setDuplicates((prev) => prev.filter((d) => d._id !== secondaryId));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to dismiss duplicate",
      );
      throw error;
    } finally {
      setIsDismissing(false);
    }
  };

  return {
    duplicates,
    recentMerges,
    isLoading,
    isError,
    mergeMeetings,
    isMerging,
    rollbackMerge,
    isRollingBack,
    dismissDuplicate,
    isDismissing,
    refreshDuplicates: fetchDuplicates,
  };
};
