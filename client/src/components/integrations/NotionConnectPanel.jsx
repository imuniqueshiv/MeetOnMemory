import React, { useEffect } from "react";
import { useNotionIntegration } from "../../hooks/useNotionIntegration.js";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Loader2, Link, Unlink, FileText } from "lucide-react";
import NotionSyncHistoryPanel from "./NotionSyncHistoryPanel.jsx";

const NotionConnectPanel = ({ canEdit }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    loading,
    connected,
    workspaceName,
    targetDatabaseId,
    databases,
    loadingDatabases,
    saving,
    history,
    loadingHistory,
    syncingMeetingId,
    handleConnect,
    handleDisconnect,
    saveDatabaseMapping,
    fetchHistory,
    syncMeeting,
  } = useNotionIntegration();

  useEffect(() => {
    const integrationStatus = searchParams.get("integration");
    if (integrationStatus === "notion_success") {
      toast.success("Successfully connected to Notion!");
      searchParams.delete("integration");
      setSearchParams(searchParams);
    } else if (integrationStatus === "notion_error") {
      toast.error("Failed to connect to Notion.");
      searchParams.delete("integration");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!connected ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect your Notion workspace to automatically sync AI-generated
            meeting summaries and action items into a specific database.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={!canEdit}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Link className="w-4 h-4" />
            Connect Notion
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                <Link className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">
                  Connected to Notion Workspace:{" "}
                  {workspaceName || "Unknown Workspace"}
                </h3>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                  Active Connection
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={!canEdit || saving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Target Database
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Select the Notion database where new meeting summaries should be
              created. Make sure you have shared the database with the
              "MeetOnMemory" integration in Notion.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
                <select
                  value={targetDatabaseId}
                  onChange={(e) => saveDatabaseMapping(e.target.value)}
                  disabled={!canEdit || saving || loadingDatabases}
                  className="block w-full pl-10 pr-10 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select a database...
                  </option>
                  {databases.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.title}
                    </option>
                  ))}
                </select>
                {loadingDatabases && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sync History Dashboard Panel */}
          <NotionSyncHistoryPanel
            canEdit={canEdit}
            history={history}
            loadingHistory={loadingHistory}
            fetchHistory={fetchHistory}
            syncMeeting={syncMeeting}
            syncingMeetingId={syncingMeetingId}
          />
        </div>
      )}
    </div>
  );
};

export default NotionConnectPanel;
