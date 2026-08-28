import React, { useState, useEffect } from "react";
import {
  X,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  ChevronDown,
  ChevronRight,
  Database,
} from "lucide-react";
import {
  replayMutation,
  dequeueMutation,
  clearQueue,
  replayQueuedMutations,
  subscribeQueue,
  isReplayActive,
} from "../services/offlineQueue.js";
import { toast } from "react-toastify";

const METHOD_COLORS = {
  POST: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  PUT: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  PATCH:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800",
  DELETE:
    "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800",
};

const STATUS_BADGES = {
  queued:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  syncing:
    "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800",
  failed:
    "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800",
};

export default function OfflineQueueInspector({ isOpen, onClose }) {
  const [queue, setQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedPayloads, setExpandedPayloads] = useState({});
  const [retryingId, setRetryingId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeQueue((updatedQueue) => {
      setQueue(updatedQueue);
      setIsSyncing(isReplayActive());
    });

    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncComplete = () => setIsSyncing(false);

    window.addEventListener("offline-sync-start", handleSyncStart);
    window.addEventListener("offline-sync-complete", handleSyncComplete);

    return () => {
      unsubscribe();
      window.removeEventListener("offline-sync-start", handleSyncStart);
      window.removeEventListener("offline-sync-complete", handleSyncComplete);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const togglePayload = (id) => {
    setExpandedPayloads((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleRetrySingle = async (id) => {
    setRetryingId(id);
    try {
      const result = await replayMutation(id);
      if (result.success) {
        toast.success("Mutation replayed successfully!");
      } else {
        toast.error(`Replay failed: ${result.error}`);
      }
    } catch (err) {
      toast.error(`Failed to replay mutation: ${err?.message || err}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDiscardSingle = async (id) => {
    try {
      await dequeueMutation(id);
      toast.info("Mutation removed from queue.");
    } catch (err) {
      toast.error(`Failed to discard mutation: ${err?.message || err}`);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const result = await replayQueuedMutations();
      if (result.succeeded > 0 && result.failed === 0) {
        toast.success(`Successfully synced ${result.succeeded} mutation(s)!`);
      } else if (result.failed > 0) {
        toast.warn(
          `Sync finished: ${result.succeeded} succeeded, ${result.failed} failed.`,
        );
      } else if (result.total === 0) {
        toast.info("Queue is empty.");
      }
    } catch (err) {
      toast.error(`Sync all failed: ${err?.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to discard all queued offline changes? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await clearQueue();
      toast.info("Offline queue cleared.");
    } catch (err) {
      toast.error(`Failed to clear queue: ${err?.message || err}`);
    }
  };

  const formatUrl = (rawUrl) => {
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      return parsed.pathname + parsed.search;
    } catch {
      return rawUrl || "Unknown endpoint";
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "Just now";
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="queue-inspector-title"
    >
      <div className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="queue-inspector-title"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"
              >
                Offline Mutation Queue
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {queue.length} {queue.length === 1 ? "item" : "items"}
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Inspect, retry, or discard mutations saved in local IndexedDB.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Inspector"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                navigator.onLine ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {navigator.onLine
              ? "Online (Ready to sync)"
              : "Offline (Writes stored locally)"}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAll}
              disabled={queue.length === 0 || isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Queue
            </button>
            <button
              onClick={handleSyncAll}
              disabled={queue.length === 0 || isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Syncing..." : "Sync All Now"}
            </button>
          </div>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                Queue is completely clear
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                All local actions and mutations are currently in sync with the
                remote server.
              </p>
            </div>
          ) : (
            queue.map((item, index) => {
              const method = (item.method || "POST").toUpperCase();
              const methodColor = METHOD_COLORS[method] || METHOD_COLORS.POST;
              const status = item.status || "queued";
              const statusBadge = STATUS_BADGES[status] || STATUS_BADGES.queued;
              const isExpanded = !!expandedPayloads[item.id];
              const isRowRetrying =
                retryingId === item.id || (isSyncing && status === "syncing");

              return (
                <div
                  key={item.id || index}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border tracking-wider ${methodColor}`}
                      >
                        {method}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold font-mono text-gray-900 dark:text-gray-100 truncate">
                            {formatUrl(item.url)}
                          </p>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${statusBadge}`}
                          >
                            {status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(item.timestamp)}
                          </span>
                          {item.idempotencyKey && (
                            <span className="font-mono text-[10px] text-gray-400 truncate max-w-[140px]">
                              Key: {item.idempotencyKey}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-center">
                      <button
                        onClick={() => handleRetrySingle(item.id)}
                        disabled={isRowRetrying || isSyncing}
                        aria-label={`Retry mutation ${item.id}`}
                        className="p-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60 rounded-lg disabled:opacity-40 transition-colors"
                        title="Retry this mutation"
                      >
                        <Send
                          className={`w-3.5 h-3.5 ${isRowRetrying ? "animate-spin" : ""}`}
                        />
                      </button>
                      <button
                        onClick={() => handleDiscardSingle(item.id)}
                        disabled={isRowRetrying || isSyncing}
                        aria-label={`Discard mutation ${item.id}`}
                        className="p-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-lg disabled:opacity-40 transition-colors"
                        title="Discard from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Error Notification */}
                  {item.error && (
                    <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.error}</span>
                    </div>
                  )}

                  {/* Payload Toggle */}
                  {item.body && (
                    <div className="mt-3 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                      <button
                        onClick={() => togglePayload(item.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        {isExpanded ? "Hide Payload" : "View Payload"}
                      </button>
                      {isExpanded && (
                        <pre className="mt-2 p-2.5 rounded-lg bg-gray-900 text-gray-100 text-[11px] font-mono overflow-x-auto max-h-36">
                          {typeof item.body === "object"
                            ? JSON.stringify(item.body, null, 2)
                            : String(item.body)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mutations are automatically replayed when internet connectivity is
            re-established.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
