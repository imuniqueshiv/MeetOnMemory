import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  History,
  FileText,
} from "lucide-react";

export default function NotionSyncHistoryPanel({
  canEdit = true,
  history = [],
  loadingHistory = false,
  fetchHistory,
  syncMeeting,
  syncingMeetingId,
}) {
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (fetchHistory) {
      fetchHistory({ status: statusFilter });
    }
  }, [fetchHistory, statusFilter]);

  const handleRetry = async (meetingId) => {
    if (!syncMeeting || !meetingId) return;
    await syncMeeting(meetingId, true);
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700/80 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Notion Sync History
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit log of per-meeting Notion sync jobs, statuses, and retry
            attempts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Buttons */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100/60 dark:bg-slate-800 text-xs">
            {["all", "success", "failed"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition ${
                  statusFilter === st
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              fetchHistory && fetchHistory({ status: statusFilter })
            }
            disabled={loadingHistory}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
            title="Refresh History"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Meeting</th>
                <th className="py-3 px-4">Sync Time</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Error / Details</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loadingHistory && history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto mb-1" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Loading sync history...
                    </span>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No Notion sync history found.
                  </td>
                </tr>
              ) : (
                history.map((log, index) => {
                  const isSyncingThis = syncingMeetingId === log.meetingId;
                  const isFailed = log.status === "failed";

                  return (
                    <tr
                      key={log._id || index}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Meeting Title */}
                      <td className="py-3 px-4 align-middle">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {log.meetingTitle || "Meeting Record"}
                          </span>
                        </div>
                      </td>

                      {/* Sync Timestamp */}
                      <td className="py-3 px-4 align-middle text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {log.syncedAt
                          ? new Date(log.syncedAt).toLocaleString()
                          : "N/A"}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-900/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold text-[11px] border border-red-200 dark:border-red-900/40">
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Error Message or Link */}
                      <td className="py-3 px-4 align-middle max-w-xs">
                        {isFailed ? (
                          <span className="text-red-600 dark:text-red-400 text-xs font-mono line-clamp-2">
                            {log.errorMessage || "Unknown error"}
                          </span>
                        ) : log.notionPageUrl ? (
                          <a
                            href={log.notionPageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                          >
                            <span>Open in Notion</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">
                            Synced
                          </span>
                        )}
                      </td>

                      {/* Retry Button */}
                      <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRetry(log.meetingId)}
                          disabled={!canEdit || isSyncingThis || !log.meetingId}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition disabled:opacity-50 cursor-pointer"
                        >
                          {isSyncingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>
                            {isSyncingThis ? "Syncing..." : "Retry Sync"}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
