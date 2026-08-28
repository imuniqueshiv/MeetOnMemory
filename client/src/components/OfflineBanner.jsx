import React, { useState, useEffect, useCallback } from "react";
import { WifiOff, RefreshCw, AlertTriangle, Database, X } from "lucide-react";
import {
  subscribeQueue,
  replayQueuedMutations,
  isReplayActive,
} from "../services/offlineQueue.js";
import OfflineQueueInspector from "./OfflineQueueInspector.jsx";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queue, setQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const updateNetworkState = useCallback(() => {
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      setIsDismissed(false); // Re-surface banner if network goes down
    }
  }, []);

  useEffect(() => {
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);

    const unsubscribe = subscribeQueue((updatedQueue) => {
      setQueue(updatedQueue);
      setIsSyncing(isReplayActive());
    });

    const handleSyncStart = () => {
      setIsSyncing(true);
      setIsDismissed(false);
    };

    const handleSyncProgress = (e) => {
      if (e.detail) {
        setSyncProgress({
          current: e.detail.current || 0,
          total: e.detail.total || 0,
        });
      }
    };

    const handleSyncComplete = () => {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    };

    window.addEventListener("offline-sync-start", handleSyncStart);
    window.addEventListener("offline-sync-progress", handleSyncProgress);
    window.addEventListener("offline-sync-complete", handleSyncComplete);

    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
      window.removeEventListener("offline-sync-start", handleSyncStart);
      window.removeEventListener("offline-sync-progress", handleSyncProgress);
      window.removeEventListener("offline-sync-complete", handleSyncComplete);
      unsubscribe();
    };
  }, [updateNetworkState]);

  const failedItems = queue.filter((item) => item.status === "failed");
  const hasQueuedItems = queue.length > 0;

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await replayQueuedMutations();
    } catch (err) {
      console.warn("[Offline Banner] Manual sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // If online, not syncing, no queue or dismissed, don't show the banner
  if (isOnline && !isSyncing && !hasQueuedItems) {
    return (
      <OfflineQueueInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    );
  }

  if (isDismissed && isOnline && !isSyncing) {
    return (
      <OfflineQueueInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    );
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={`relative z-40 px-4 py-2.5 transition-colors text-xs sm:text-sm font-medium shadow-xs ${
          !isOnline
            ? "bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-white"
            : isSyncing
              ? "bg-blue-600 text-white"
              : failedItems.length > 0
                ? "bg-rose-600 text-white"
                : "bg-indigo-600 text-white"
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {!isOnline ? (
              <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            ) : isSyncing ? (
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
            ) : failedItems.length > 0 ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Database className="w-4 h-4 shrink-0" />
            )}

            <div className="truncate">
              {!isOnline ? (
                <span>
                  <strong>You are offline.</strong>{" "}
                  {hasQueuedItems
                    ? `${queue.length} change${queue.length === 1 ? "" : "s"} saved locally and waiting to sync.`
                    : "Actions will be saved locally until connectivity is restored."}
                </span>
              ) : isSyncing ? (
                <span>
                  <strong>Reconnecting...</strong> Replaying queued mutations{" "}
                  {syncProgress.total > 0
                    ? `(${syncProgress.current} of ${syncProgress.total})`
                    : ""}
                </span>
              ) : failedItems.length > 0 ? (
                <span>
                  <strong>Sync Issue:</strong> {failedItems.length} offline{" "}
                  {failedItems.length === 1 ? "change" : "changes"} failed to
                  sync automatically.
                </span>
              ) : (
                <span>
                  <strong>Pending Sync:</strong> {queue.length} offline{" "}
                  {queue.length === 1 ? "change is" : "changes are"} ready to be
                  synced.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasQueuedItems && (
              <button
                onClick={() => setIsInspectorOpen(true)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold backdrop-blur-xs transition-colors ${
                  !isOnline
                    ? "bg-amber-600/30 hover:bg-amber-600/50 text-amber-950 dark:text-white"
                    : "bg-white/20 hover:bg-white/30 text-white"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                Inspect Queue ({queue.length})
              </button>
            )}

            {isOnline && hasQueuedItems && !isSyncing && (
              <button
                onClick={handleManualSync}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-gray-900 hover:bg-gray-100 shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync Now
              </button>
            )}

            {isOnline && !isSyncing && (
              <button
                onClick={() => setIsDismissed(true)}
                aria-label="Dismiss banner"
                className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sync Progress Bar */}
        {isSyncing && syncProgress.total > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-200"
              style={{
                width: `${Math.min(
                  100,
                  (syncProgress.current / syncProgress.total) * 100,
                )}%`,
              }}
            />
          </div>
        )}
      </div>

      <OfflineQueueInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    </>
  );
}
