import React from "react";
import { Save, CheckCircle, WifiOff, Loader2, AlertCircle } from "lucide-react";

/** Keep labels aligned with useCollaborativeNote syncStatus values (#2250). */
const STATUS = {
  CONNECTING: "connecting",
  SYNCED: "synced",
  SAVING: "saving",
  OFFLINE: "offline",
  ERROR: "error",
};

/**
 * PersonalNotes-style status chip for collaborative notes sync (#2250).
 */
const CollabSyncStatusChip = ({ syncStatus, isReadOnly = false }) => {
  if (isReadOnly && syncStatus === STATUS.SYNCED) {
    return (
      <span
        className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400"
        data-testid="collab-sync-status"
        data-status="synced"
      >
        <CheckCircle className="w-3 h-3 mr-1" />
        Viewing live
      </span>
    );
  }

  switch (syncStatus) {
    case STATUS.CONNECTING:
      return (
        <span
          className="inline-flex items-center text-xs text-slate-500 dark:text-gray-400"
          data-testid="collab-sync-status"
          data-status="connecting"
        >
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Connecting...
        </span>
      );
    case STATUS.SAVING:
      return (
        <span
          className="inline-flex items-center text-xs text-amber-500"
          data-testid="collab-sync-status"
          data-status="saving"
        >
          <Save className="w-3 h-3 mr-1 animate-pulse" />
          Saving...
        </span>
      );
    case STATUS.SYNCED:
      return (
        <span
          className="inline-flex items-center text-xs text-emerald-500"
          data-testid="collab-sync-status"
          data-status="synced"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Synced
        </span>
      );
    case STATUS.OFFLINE:
      return (
        <span
          className="inline-flex items-center text-xs text-amber-600 dark:text-amber-400"
          data-testid="collab-sync-status"
          data-status="offline"
        >
          <WifiOff className="w-3 h-3 mr-1" />
          Offline — changes may not sync
        </span>
      );
    case STATUS.ERROR:
      return (
        <span
          className="inline-flex items-center text-xs text-red-500"
          data-testid="collab-sync-status"
          data-status="error"
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          Error syncing
        </span>
      );
    default:
      return null;
  }
};

export default CollabSyncStatusChip;
