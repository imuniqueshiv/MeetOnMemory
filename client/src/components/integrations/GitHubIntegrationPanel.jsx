import React, { useState, useEffect } from "react";
import {
  Github,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderGit2,
  Activity,
  ExternalLink,
  Loader2,
  Unlink,
  Check,
} from "lucide-react";
import { toast } from "react-toastify";
import { useGitHubIntegration } from "../../hooks/useGitHubIntegration.js";

const GitHubIntegrationPanel = ({ organizationId = "" }) => {
  const {
    isConnected,
    repositoryFullName,
    repositories,
    webhookEvents,
    loading,
    eventsLoading,
    error,
    connectGitHub,
    disconnectGitHub,
    fetchRepos,
    fetchWebhookEvents,
    updateConfiguredRepo,
  } = useGitHubIntegration(organizationId);

  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepoInput, setCustomRepoInput] = useState("");
  const [isSavingRepo, setIsSavingRepo] = useState(false);

  useEffect(() => {
    if (repositoryFullName) {
      setSelectedRepo(repositoryFullName);
      setCustomRepoInput(repositoryFullName);
    }
  }, [repositoryFullName]);

  const handleSaveRepository = async (e) => {
    e.preventDefault();
    const repoToSave = (selectedRepo || customRepoInput).trim();
    if (!repoToSave || !repoToSave.includes("/")) {
      toast.error("Please provide a valid repository in 'owner/repo' format.");
      return;
    }

    setIsSavingRepo(true);
    const success = await updateConfiguredRepo(repoToSave);
    if (success) {
      toast.success(`Active repository set to ${repoToSave}`);
    } else {
      toast.error("Failed to update repository configuration.");
    }
    setIsSavingRepo(false);
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Are you sure you want to disconnect GitHub? Issue synchronization will be paused.",
      )
    ) {
      return;
    }

    const success = await disconnectGitHub();
    if (success) {
      toast.success("GitHub integration disconnected.");
    }
  };

  return (
    <div
      aria-label="GitHub Integration Management Panel"
      className="space-y-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
    >
      {/* Header & Status Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <Github className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                GitHub Integration
              </h3>
              <span
                data-testid="github-sync-status-badge"
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isConnected
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {isConnected ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Connected & Syncing
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-slate-400" />
                    Not Connected
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Bi-directional issue sync and action item automation with GitHub
            </p>
          </div>
        </div>

        <div>
          {isConnected ? (
            <button
              type="button"
              data-testid="github-disconnect-button"
              onClick={handleDisconnect}
              disabled={loading}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              data-testid="github-connect-button"
              onClick={connectGitHub}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Github className="w-4 h-4" />
              Connect GitHub
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isConnected && (
        <>
          {/* Repository Picker Section */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Target Repository Picker
                </h4>
              </div>
              <button
                type="button"
                onClick={fetchRepos}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                title="Refresh repositories list"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh Repos
              </button>
            </div>

            <form onSubmit={handleSaveRepository} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Select from Detected Repositories
                  </label>
                  <select
                    data-testid="github-repo-select"
                    value={selectedRepo}
                    onChange={(e) => {
                      setSelectedRepo(e.target.value);
                      setCustomRepoInput(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                  >
                    <option value="">Choose a repository...</option>
                    {repositories.map((repo) => (
                      <option
                        key={repo.id || repo.fullName}
                        value={repo.fullName}
                      >
                        {repo.fullName} {repo.private ? "(Private)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Or Enter Repository Full Name (owner/repo)
                  </label>
                  <input
                    type="text"
                    data-testid="github-repo-input"
                    placeholder="e.g. facebook/react or vercel/next.js"
                    value={customRepoInput}
                    onChange={(e) => {
                      setCustomRepoInput(e.target.value);
                      setSelectedRepo(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Active Configured:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {repositoryFullName || "None selected"}
                  </strong>
                </span>
                <button
                  type="submit"
                  data-testid="github-save-repo-button"
                  disabled={isSavingRepo || (!selectedRepo && !customRepoInput)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isSavingRepo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Repository
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Webhook Event Logs Table Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Webhook Event Delivery Log
                </h4>
              </div>
              <button
                type="button"
                data-testid="github-refresh-events-button"
                onClick={fetchWebhookEvents}
                disabled={eventsLoading}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3 h-3 ${eventsLoading ? "animate-spin" : ""}`}
                />
                Refresh Events
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                        Delivery ID
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                        Event
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                        Action
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {eventsLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-500" />
                          Loading webhook deliveries...
                        </td>
                      </tr>
                    ) : webhookEvents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-slate-400 dark:text-slate-500"
                        >
                          No webhook delivery events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      webhookEvents.map((evt, idx) => (
                        <tr
                          key={evt._id || evt.deliveryId || idx}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                            {evt.deliveryId || "N/A"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded font-semibold text-[11px]">
                              {evt.event || "issues"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                            {evt.action || "sync"}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {evt.createdAt
                              ? new Date(evt.createdAt).toLocaleString()
                              : "Just now"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Processed
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GitHubIntegrationPanel;
