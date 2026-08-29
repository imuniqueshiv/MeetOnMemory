import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../../services/apiClient";
import { toast } from "react-toastify";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
} from "lucide-react";

/**
 * Webhook event log panel component (Issue #2660).
 * Shows incoming webhook deliveries for Jira/Linear with parity to GitHub integration UI.
 */
const WebhookEventLogPanel = ({ provider }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter !== "all") params.status = statusFilter;

      const res = await apiClient.get(
        `/api/webhooks/${provider}/logs`,
        { params },
      );
      if (res.data?.success) {
        setLogs(res.data.data?.logs || []);
        setTotalPages(res.data.data?.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error(`Error fetching ${provider} webhook logs:`, err);
    } finally {
      setLoading(false);
    }
  }, [provider, page, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const statusIcon = (status) => {
    switch (status) {
      case "success":
        return (
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case "failed":
        return (
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <XCircle className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
    }
  };

  const statusBadge = (status) => {
    const base =
      "px-2 py-0.5 rounded-md text-xs font-mono font-medium";
    switch (status) {
      case "success":
        return `${base} bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300`;
      case "failed":
        return `${base} bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300`;
      default:
        return `${base} bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300`;
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Incoming Webhook Event Log
          </h4>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          title="Refresh logs"
          aria-label="Refresh webhook event logs"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-4">
        {["all", "success", "failed", "ignored"].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
              statusFilter === st
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Log entries */}
      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className="text-sm">Fetching event logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No webhook events recorded yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Triggered events will appear here with status and timing info.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((item) => {
            const isExpanded = expandedRow === item._id;
            return (
              <div
                key={item._id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800/60"
              >
                {/* Log header */}
                <div
                  onClick={() => toggleExpand(item._id)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(item._id);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(item.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.eventType}
                        </span>
                        <span className={statusBadge(item.status)}>
                          {item.status}
                        </span>
                        {item.action && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {item.action}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{item.processingTimeMs || 0} ms</span>
                        <span>·</span>
                        <span>
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                    {item.error && (
                      <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-700 dark:text-rose-300">
                        <strong>Error:</strong> {item.error}
                      </div>
                    )}

                    {item.payload && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Payload Summary
                        </div>
                        <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto max-h-36">
                          {JSON.stringify(item.payload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {item.issueKey && (
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        <strong>Issue Key:</strong>{" "}
                        <span className="font-mono">{item.issueKey}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs">
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const IssueTrackerConfig = ({ provider, title, description, icon }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [configData, setConfigData] = useState({});
  const [tokenInput, setTokenInput] = useState("");
  const [projectInput, setProjectInput] = useState("");

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get(`/api/issue-tracker/${provider}/config`);
      if (res.data?.data) {
        setIsConnected(true);
        setConfigData(res.data.data.config || {});
        setProjectInput(
          res.data.data.config?.projectId ||
            res.data.data.config?.projectKey ||
            res.data.data.config?.teamId ||
            "",
        );
      } else {
        setIsConnected(false);
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

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      toast.error("Please enter a valid access token");
      return;
    }

    try {
      setIsSaving(true);

      const payloadConfig = {};
      if (provider === "jira") payloadConfig.projectKey = projectInput;
      if (provider === "linear") payloadConfig.teamId = projectInput;

      await apiClient.post(`/api/issue-tracker/${provider}/config`, {
        accessToken: tokenInput,
        config: payloadConfig,
      });

      toast.success(`Connected to ${title} successfully`);
      setTokenInput("");
      fetchConfig();
    } catch (error) {
      toast.error(`Failed to connect to ${title}`);
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
    } catch (error) {
      toast.error(`Failed to disconnect from ${title}`);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
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
            onClick={handleDisconnect}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Disconnect"
            )}
          </button>
        ) : null}
      </div>

      {!isLoading && !isConnected && (
        <form
          onSubmit={handleConnect}
          className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={`Enter your ${title} token`}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Default Project / Team Key
            </label>
            <input
              type="text"
              value={projectInput}
              onChange={(e) => setProjectInput(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={`e.g. PROJ or TEAM-ID`}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSaving || !tokenInput}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Connect {title}
          </button>
        </form>
      )}

      {isConnected && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Connected Project / Team
              </span>
              <span className="text-slate-900 dark:text-white font-semibold">
                {configData?.projectKey || configData?.teamId || "Configured"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Two-way sync active
            </div>
          </div>

          {/* Webhook Event Log Panel (Issue #2660) */}
          <WebhookEventLogPanel provider={provider} />
        </div>
      )}
    </div>
  );
};

export default IssueTrackerConfig;
