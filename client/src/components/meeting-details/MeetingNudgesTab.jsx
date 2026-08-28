import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Sparkles,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Sliders,
  Users,
  Clock,
  ShieldCheck,
  Check,
} from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../services/apiClient.js";

const MeetingNudgesTab = ({ meetingId, isOrganizer = false }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchNudgePreview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(
        `/api/nudges/meeting/${meetingId}/preview`,
      );
      if (res.data && res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch nudge preview", err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchNudgePreview();
  }, [fetchNudgePreview]);

  const handleTriggerManualNudges = async () => {
    try {
      setTriggering(true);
      const res = await apiClient.post(
        `/api/nudges/meeting/${meetingId}/trigger`,
      );
      if (res.data?.success) {
        toast.success(
          res.data.message || "Test nudges generated and delivered!",
        );
        fetchNudgePreview();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to trigger nudges");
    } finally {
      setTriggering(false);
    }
  };

  const handleToggleAutomation = async () => {
    if (!data) return;
    try {
      setToggling(true);
      const nextState = !data.nudgesEnabled;
      const res = await apiClient.patch(
        `/api/nudges/meeting/${meetingId}/settings`,
        {
          enabled: nextState,
        },
      );
      if (res.data?.success) {
        setData((prev) => ({ ...prev, nudgesEnabled: nextState }));
        toast.success(res.data.message);
      }
    } catch (err) {
      console.error("Failed to update nudge automation settings", err);
      toast.error("Failed to update nudge automation settings");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 animate-pulse">
        Analyzing participant readiness and synthesizing nudge previews...
      </div>
    );
  }

  const participants = data?.participants || [];
  const avgScore = data?.averageScore ?? 100;
  const isEnabled = data?.nudgesEnabled ?? true;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Pre-Meeting Preparation & Nudges
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isEnabled
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {isEnabled ? "Automation Active" : "Automation Paused"}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Preview automated reminders sent to participants before meeting
                kick-off.
              </p>
            </div>
          </div>
        </div>

        {/* Organizer Actions */}
        {isOrganizer && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleToggleAutomation}
              disabled={toggling}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isEnabled
                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              {isEnabled ? "Pause Nudges" : "Enable Nudges"}
            </button>

            <button
              type="button"
              onClick={handleTriggerManualNudges}
              disabled={triggering}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
            >
              {triggering ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Test Dispatch</span>
            </button>
          </div>
        )}
      </div>

      {/* Readiness Overview Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-linear-to-br from-indigo-50/50 to-blue-50/50 dark:from-slate-850 dark:to-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Overall Readiness Score
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-2xl font-black ${
                avgScore >= 80
                  ? "text-emerald-600 dark:text-emerald-400"
                  : avgScore >= 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {avgScore}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              across {participants.length} participant(s)
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Pending Action Items
          </span>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-2">
            {participants.reduce((sum, p) => sum + (p.unresolvedCount || 0), 0)}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Agenda Review Rate
          </span>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-2">
            {participants.length
              ? Math.round(
                  (participants.filter((p) => p.hasViewedAgenda).length /
                    participants.length) *
                    100,
                )
              : 100}
            %
          </div>
        </div>
      </div>

      {/* Participant Nudge Previews */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Participant Readiness & Planned Nudges
        </h4>

        {participants.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            {participants.map((p) => {
              const score = p.readinessScore;
              return (
                <div
                  key={p.user?._id || p.user?.email}
                  className="p-4 bg-white dark:bg-gray-850 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {(p.user?.name || "P").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                          {p.user?.name || "Participant"}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            score >= 80
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : score >= 50
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-rose-50 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {score}% Ready
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {p.user?.email || "—"}
                      </p>

                      {/* Planned nudges list */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.plannedNudges?.map((nudge, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                          >
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            {nudge.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 md:text-right space-y-1">
                    <div>
                      Agenda:{" "}
                      {p.hasViewedAgenda ? (
                        <span className="text-emerald-600 font-semibold">
                          Viewed
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold">
                          Unviewed
                        </span>
                      )}
                    </div>
                    <div>
                      Pending items:{" "}
                      <span className="font-semibold">{p.unresolvedCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl">
            No participants configured for this meeting.
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingNudgesTab;
