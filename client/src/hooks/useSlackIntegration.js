// client/src/hooks/useSlackIntegration.js
import { useState, useEffect, useCallback } from "react";
import slackApi from "../services/slackApi.js";
import { toast } from "react-toastify";

/**
 * Custom React hook for managing Slack Integration (#2007).
 * Provides status fetching, OAuth initiation, disconnect, and channel configuration.
 */
export const useSlackIntegration = (organizationId = "") => {
  const [isConnected, setIsConnected] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [installedAt, setInstalledAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch current Slack integration status
   */
  const fetchStatus = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await slackApi.getStatus(organizationId);
      if (data?.success) {
        setIsConnected(Boolean(data.isConnected));
        setTeamName(data.teamName || "");
        setTeamId(data.teamId || "");
        setChannelId(data.channelId || "");
        setInstalledAt(data.installedAt || null);
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error("Error checking Slack status:", err);
      setError(err.response?.data?.message || "Failed to check Slack status.");
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  /**
   * Initiate Slack OAuth installation
   */
  const connectSlack = useCallback(() => {
    if (!organizationId) return;
    const url = slackApi.getInstallUrl(organizationId);
    window.location.href = url;
  }, [organizationId]);

  /**
   * Disconnect Slack integration
   */
  const disconnectSlack = useCallback(async () => {
    if (!organizationId) return false;
    setSaving(true);
    setError(null);
    try {
      const data = await slackApi.disconnect(organizationId);
      if (data?.success) {
        setIsConnected(false);
        setTeamName("");
        setTeamId("");
        setChannelId("");
        setInstalledAt(null);
        toast.success("Slack integration disconnected successfully.");
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error disconnecting Slack:", err);
      const msg =
        err.response?.data?.message ||
        "Failed to disconnect Slack integration.";
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [organizationId]);

  /**
   * Update default Slack channel ID
   */
  const updateChannel = useCallback(
    async (newChannelId) => {
      if (!organizationId) return false;
      setSaving(true);
      setError(null);
      try {
        const data = await slackApi.updateChannel(organizationId, newChannelId);
        if (data?.success) {
          setChannelId(data.channelId);
          toast.success("Default Slack channel updated.");
          return true;
        }
        return false;
      } catch (err) {
        console.error("Error updating Slack channel:", err);
        const msg =
          err.response?.data?.message || "Failed to update Slack channel.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    isConnected,
    teamName,
    teamId,
    channelId,
    installedAt,
    loading,
    saving,
    error,
    fetchStatus,
    connectSlack,
    disconnectSlack,
    updateChannel,
  };
};

export default useSlackIntegration;
