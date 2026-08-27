import React, { useState } from "react";
import {
  Eye,
  UserCheck,
  UserX,
  Clock,
  Shield,
  Loader2,
  Send,
  Users,
} from "lucide-react";
import { useObservers } from "../../hooks/useObservers.js";

export const ObserverApprovalPanel = ({
  meeting,
  currentUser,
  onMeetingUpdated,
}) => {
  const { isLoading, shadowRequest, handleShadowRequest } = useObservers();
  const [requested, setRequested] = useState(false);

  if (!meeting) return null;

  const isHost =
    meeting.uploadedBy?._id === currentUser?._id ||
    meeting.uploadedBy === currentUser?._id ||
    meeting.uploadedBy === currentUser?.id;

  const isParticipant = (meeting.participants || []).some(
    (p) =>
      (p.user?._id || p.user || p._id) === currentUser?._id ||
      (p.user?._id || p.user || p._id) === currentUser?.id ||
      p.email === currentUser?.email,
  );

  const observers = (meeting.participants || []).filter(
    (p) => p.role === "observer",
  );

  const handleRequest = async () => {
    try {
      await shadowRequest(meeting._id);
      setRequested(true);
    } catch (_err) {
      // toast is already handled in useObservers
    }
  };

  const handleAction = async (userId, action) => {
    try {
      await handleShadowRequest(meeting._id, userId, action);
      if (onMeetingUpdated) {
        onMeetingUpdated();
      }
    } catch (_err) {
      // toast is already handled in useObservers
    }
  };

  // If user is not participant and meeting allows observers, show Request to Shadow Card
  if (!isParticipant && meeting.allowObservers) {
    return (
      <div
        data-testid="observer-request-card"
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-6 shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Shadow as Observer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Request silent observer access to observe this meeting in
                real-time
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="request-shadow-button"
            onClick={handleRequest}
            disabled={isLoading || requested}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {requested ? "Request Pending" : "Request Shadow Access"}
          </button>
        </div>
      </div>
    );
  }

  // If user is host, show Observers & Shadow Access Management
  if (isHost) {
    return (
      <div
        data-testid="observer-management-panel"
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Observer & Shadow Roster
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {observers.length} Active
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage silent shadow participants permitted in this session
              </p>
            </div>
          </div>
        </div>

        {observers.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            No observers are currently shadowing this meeting.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {observers.map((obs) => {
              const obsUserId = obs.user?._id || obs.user || obs._id;
              return (
                <div
                  key={obsUserId}
                  data-testid="observer-item"
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
                      {(obs.name || obs.email || "O").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {obs.name || "Anonymous Observer"}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {obs.email}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Observer
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default ObserverApprovalPanel;
