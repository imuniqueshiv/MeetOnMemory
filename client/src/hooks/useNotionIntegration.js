import { useState, useEffect, useCallback } from "react";
import { notionIntegrationApi } from "../services/notionIntegrationApi.js";
import { toast } from "react-toastify";

export const useNotionIntegration = () => {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [targetDatabaseId, setTargetDatabaseId] = useState("");
  const [databases, setDatabases] = useState([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync History state
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [syncingMeetingId, setSyncingMeetingId] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await notionIntegrationApi.getStatus();
      const payload = data?.data || data;
      if (payload && (payload.connected || payload.isConnected)) {
        setConnected(true);
        setWorkspaceName(payload.workspaceName || "");
        setTargetDatabaseId(payload.targetDatabaseId || "");
        fetchDatabases();
      } else {
        setConnected(false);
      }
    } catch (err) {
      console.error("Failed to fetch Notion integration status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDatabases = async () => {
    try {
      setLoadingDatabases(true);
      const { data } = await notionIntegrationApi.getDatabases();
      const payload = data?.data || data;
      if (payload?.databases) {
        setDatabases(payload.databases);
      }
    } catch (err) {
      console.error("Failed to fetch databases:", err);
      toast.error("Failed to fetch Notion databases.");
    } finally {
      setLoadingDatabases(false);
    }
  };

  const fetchHistory = useCallback(async (params = {}) => {
    try {
      setLoadingHistory(true);
      const { data } = await notionIntegrationApi.getHistory(params);
      const payload = data?.data || data;
      if (payload?.history) {
        setHistory(payload.history);
        setHistoryTotal(payload.total || payload.history.length);
      }
    } catch (err) {
      console.error("Failed to fetch Notion sync history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const { data } = await notionIntegrationApi.getAuthUrl();
      const payload = data?.data || data;
      if (payload && (payload.authUrl || payload.url)) {
        window.location.href = payload.authUrl || payload.url;
      }
    } catch (err) {
      console.error("Failed to get Notion Auth URL:", err);
      toast.error("Failed to connect to Notion.");
    }
  };

  const handleDisconnect = async () => {
    try {
      setSaving(true);
      const { data } = await notionIntegrationApi.disconnect();
      if (data.success || data?.status === 200) {
        setConnected(false);
        setWorkspaceName("");
        setTargetDatabaseId("");
        setDatabases([]);
        setHistory([]);
        toast.success("Disconnected from Notion successfully.");
      }
    } catch (err) {
      console.error("Failed to disconnect:", err);
      toast.error("Failed to disconnect from Notion.");
    } finally {
      setSaving(false);
    }
  };

  const saveDatabaseMapping = async (dbId) => {
    try {
      setSaving(true);
      const { data } = await notionIntegrationApi.saveMapping(dbId);
      if (data.success || data?.status === 200) {
        setTargetDatabaseId(dbId);
        toast.success("Notion database mapping saved!");
      }
    } catch (err) {
      console.error("Failed to save mapping:", err);
      toast.error("Failed to save database mapping.");
    } finally {
      setSaving(false);
    }
  };

  const syncMeeting = async (meetingId, force = false) => {
    try {
      setSyncingMeetingId(meetingId);
      const { data } = await notionIntegrationApi.syncMeeting(meetingId, force);
      const payload = data?.data || data;
      if (payload?.alreadySynced) {
        toast.info("Meeting is already synced to Notion.");
      } else {
        toast.success("Successfully synced meeting to Notion!");
      }
      fetchHistory();
      return payload;
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to sync meeting to Notion";
      toast.error(msg);
      fetchHistory();
      throw err;
    } finally {
      setSyncingMeetingId(null);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    loading,
    connected,
    workspaceName,
    targetDatabaseId,
    databases,
    loadingDatabases,
    saving,
    history,
    historyTotal,
    loadingHistory,
    syncingMeetingId,
    handleConnect,
    handleDisconnect,
    saveDatabaseMapping,
    fetchHistory,
    syncMeeting,
  };
};
