import React, { useState, useEffect } from "react";
import apiClient from "../../services/apiClient";
import { toast } from "react-toastify";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const IssueTrackerConfig = ({ provider, title, description, icon }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [configData, setConfigData] = useState({});
  const [tokenInput, setTokenInput] = useState("");
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [projectInput, setProjectInput] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fieldMappings, setFieldMappings] = useState({
    syncAssignee: true,
    syncDueDate: true,
    syncPriority: true,
    syncStatus: true,
  });

  const [statusMappings, setStatusMappings] = useState({
    open: "To Do",
    in_progress: "In Progress",
    completed: "Done",
  });

  const [syncStatusData, setSyncStatusData] = useState({
    lastSyncAt: null,
    lastSyncStatus: "idle",
    lastSyncError: null,
    syncCount: 0,
    syncLogs: [],
  });

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const [configRes, statusRes] = await Promise.all([
        apiClient.get(`/api/issue-tracker/${provider}/config`),
        apiClient.get(`/api/issue-tracker/${provider}/sync-status`),
      ]);

      if (configRes.data?.data) {
        setIsConnected(true);
        const cfg = configRes.data.data.config || {};
        setConfigData(cfg);
        setSiteUrlInput(cfg.siteUrl || "");
        setProjectInput(cfg.projectKey || cfg.teamId || cfg.projectId || "");

        if (cfg.fieldMappings) {
          setFieldMappings((prev) => ({ ...prev, ...cfg.fieldMappings }));
        }
        if (cfg.statusMappings) {
          setStatusMappings((prev) => ({ ...prev, ...cfg.statusMappings }));
        }
      } else {
        setIsConnected(false);
      }

      if (statusRes.data?.data) {
        setSyncStatusData(statusRes.data.data);
      }
    } catch (error) {
      console.error(`Error fetching ${provider} config:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const handleConnectOrUpdate = async (e) => {
    e.preventDefault();

    if (!isConnected && !tokenInput.trim()) {
      toast.error("Please enter a valid access token");
      return;
    }

    if (provider === "jira" && siteUrlInput.trim()) {
      try {
        const url = new URL(siteUrlInput);
        if (!["http:", "https:"].includes(url.protocol)) {
          toast.error("Site URL must start with http:// or https://");
          return;
        }
      } catch {
        toast.error(
          "Please enter a valid Site URL (e.g., https://your-domain.atlassian.net)",
        );
        return;
      }
    }

    try {
      setIsSaving(true);

      const payloadConfig = {
        ...(configData || {}),
        siteUrl: siteUrlInput.trim(),
        fieldMappings,
        statusMappings,
      };

      if (provider === "jira") payloadConfig.projectKey = projectInput.trim();
      if (provider === "linear") payloadConfig.teamId = projectInput.trim();

      const payload = {
        config: payloadConfig,
      };
      if (tokenInput.trim()) {
        payload.accessToken = tokenInput.trim();
      }

      await apiClient.post(`/api/issue-tracker/${provider}/config`, payload);

      toast.success(
        isConnected
          ? `Updated ${title} configuration`
          : `Connected to ${title} successfully`,
      );
      setTokenInput("");
      fetchConfig();
    } catch (error) {
      const msg =
        error.response?.data?.error || `Failed to save ${title} config`;
      toast.error(msg);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsSaving(true);
      await apiClient.delete(`/api/issue-tracker/${provider}/disconnect`);
      toast.success(`Disconnected from ${title}`);
      setIsConnected(false);
      setConfigData({});
      setSyncStatusData({
        lastSyncAt: null,
        lastSyncStatus: "idle",
        lastSyncError: null,
        syncCount: 0,
        syncLogs: [],
      });
    } catch (error) {
      toast.error(`Failed to disconnect from ${title}`);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              {title}
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                  <CheckCircle className="w-3.5 h-3.5" /> Connected
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded"></div>
        ) : isConnected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Disconnect"
            )}
          </button>
        ) : null}
      </div>

      {/* Connection & Configuration Form */}
      {!isLoading && (
        <form
          onSubmit={handleConnectOrUpdate}
          className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4"
        >
          {!isConnected && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Personal Access Token
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={`Enter your ${title} access token`}
                required={!isConnected}
              />
            </div>
          )}

          {provider === "jira" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Jira Site URL
              </label>
              <input
                type="url"
                value={siteUrlInput}
                onChange={(e) => setSiteUrlInput(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="https://your-domain.atlassian.net"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {provider === "jira" ? "Default Project Key" : "Default Team ID"}
            </label>
            <input
              type="text"
              value={projectInput}
              onChange={(e) => setProjectInput(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={provider === "jira" ? "e.g. PROJ" : "e.g. TEAM-ID"}
              required
            />
          </div>

          {/* Advanced Field & Status Mappings Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              {showAdvanced
                ? "Hide Field & Status Mapping"
                : "Configure Field & Status Mapping"}
              {showAdvanced ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {showAdvanced && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-4 border border-slate-200 dark:border-slate-700 text-sm">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                Field Mapping Preferences
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldMappings.syncAssignee}
                    onChange={(e) =>
                      setFieldMappings((p) => ({
                        ...p,
                        syncAssignee: e.target.checked,
                      }))
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Sync Assignee
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldMappings.syncDueDate}
                    onChange={(e) =>
                      setFieldMappings((p) => ({
                        ...p,
                        syncDueDate: e.target.checked,
                      }))
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Sync Due Date
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldMappings.syncPriority}
                    onChange={(e) =>
                      setFieldMappings((p) => ({
                        ...p,
                        syncPriority: e.target.checked,
                      }))
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Sync Priority
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldMappings.syncStatus}
                    onChange={(e) =>
                      setFieldMappings((p) => ({
                        ...p,
                        syncStatus: e.target.checked,
                      }))
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Sync Status
                </label>
              </div>

              <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider pt-2">
                Status Mapping
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">
                    Open
                  </span>
                  <input
                    type="text"
                    value={statusMappings.open}
                    onChange={(e) =>
                      setStatusMappings((p) => ({
                        ...p,
                        open: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">
                    In Progress
                  </span>
                  <input
                    type="text"
                    value={statusMappings.in_progress}
                    onChange={(e) =>
                      setStatusMappings((p) => ({
                        ...p,
                        in_progress: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">
                    Completed
                  </span>
                  <input
                    type="text"
                    value={statusMappings.completed}
                    onChange={(e) =>
                      setStatusMappings((p) => ({
                        ...p,
                        completed: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving || (!isConnected && !tokenInput)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isConnected ? "Save Configuration" : `Connect ${title}`}
            </button>

            {isConnected && (
              <button
                type="button"
                onClick={fetchConfig}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
              </button>
            )}
          </div>
        </form>
      )}

      {/* Sync Status Panel & Metrics */}
      {isConnected && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                Connected Workspace / Team
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {configData?.projectKey || configData?.teamId || "Configured"}
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                Bi-Directional Sync
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  syncStatusData.lastSyncStatus === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {syncStatusData.lastSyncStatus === "error" ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" /> Sync Error
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Active & Syncing
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block">Total Items Synced</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {syncStatusData.syncCount || 0} tasks
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Last Synced</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {syncStatusData.lastSyncAt
                  ? new Date(syncStatusData.lastSyncAt).toLocaleString()
                  : "Never"}
              </span>
            </div>
          </div>

          {/* Sync History Logs Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              {showLogs ? "Hide Sync History" : "View Recent Sync History"}
              {showLogs ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {showLogs && (
              <div className="mt-3 max-h-48 overflow-y-auto space-y-2 pr-1">
                {syncStatusData.syncLogs?.length > 0 ? (
                  syncStatusData.syncLogs.map((log, index) => (
                    <div
                      key={index}
                      className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200/60 dark:border-slate-700 text-xs flex items-start justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          {log.details || log.action}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          log.status === "error"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No sync logs recorded yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueTrackerConfig;
