import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Loader2,
  Link,
  Unlink,
  Hash,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import useSlackIntegration from "../../hooks/useSlackIntegration.js";

const SlackIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      fill="#E01E5A"
    />
    <path
      d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      fill="#36C5F0"
    />
    <path
      d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
      fill="#2EB67D"
    />
    <path
      d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      fill="#ECB22E"
    />
  </svg>
);

const SlackConnectPanel = ({ organizationId, canEdit = true }) => {
  const {
    isConnected,
    teamName,
    teamId,
    channelId,
    installedAt,
    loading,
    saving,
    error,
    connectSlack,
    disconnectSlack,
    updateChannel,
  } = useSlackIntegration(organizationId);

  const [inputChannel, setInputChannel] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setInputChannel(channelId || "");
  }, [channelId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const installStatus = params.get("slackInstall");
    if (installStatus === "success") {
      toast.success("Slack workspace connected successfully!");
      params.delete("slackInstall");
      params.delete("reason");
      navigate({ search: params.toString() }, { replace: true });
    } else if (installStatus === "error") {
      const reason =
        params.get("reason") || "Connection was canceled or failed.";
      toast.error(`Slack installation failed: ${decodeURIComponent(reason)}`);
      params.delete("slackInstall");
      params.delete("reason");
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [location, navigate]);

  const handleSaveChannel = async (e) => {
    e.preventDefault();
    if (!canEdit || saving) return;
    await updateChannel(inputChannel);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center p-2.5 flex-shrink-0 border border-slate-200/60 dark:border-slate-700">
            <SlackIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Slack Workspace Integration
              </h3>
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Dispatch meeting summaries, action alerts, and create meetings
              directly using the{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-800 dark:text-slate-200 font-mono text-xs">
                /mom-create
              </code>{" "}
              command.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
          {loading ? (
            <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
          ) : isConnected ? (
            <button
              type="button"
              onClick={disconnectSlack}
              disabled={!canEdit || saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/60 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={connectSlack}
              disabled={!canEdit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Link className="w-4 h-4" />
              Connect Slack
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isConnected && (
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                Connected Workspace
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {teamName || "Slack Workspace"}
                {teamId && (
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                    ({teamId})
                  </span>
                )}
              </p>
              {installedAt && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Connected on {new Date(installedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                Default Notification Channel
              </span>
              <form
                onSubmit={handleSaveChannel}
                className="flex items-center gap-2 mt-1"
              >
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={inputChannel}
                    onChange={(e) => setInputChannel(e.target.value)}
                    disabled={!canEdit || saving}
                    placeholder="e.g. C012345678 or #general"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {canEdit && (
                  <button
                    type="submit"
                    disabled={saving || inputChannel === (channelId || "")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    {saving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlackConnectPanel;
