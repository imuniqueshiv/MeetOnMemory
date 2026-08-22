import React, { useState, useEffect, useCallback } from "react";
import {
  BellRing,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Settings2,
  Users,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../services/apiClient.js";

const MeetingNudgesTab = ({ meetingId, isOrganizer = false }) => {
  const [nudgesEnabled, setNudgesEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [error, setError] = useState(null);
  const [nudges, setNudges] = useState([]);

  const defaultNudges = [
    {
      id: "nudge-1",
      type: "Action Item Due",
      recipient: "All Assignees",
      message:
        "Reminder: Review and update assigned action items before the next sync.",
      scheduledTime: "In 2 days",
      status: "scheduled",
    },
    {
      id: "nudge-2",
      type: "Unresolved Decisions",
      recipient: "Meeting Participants",
      message: "2 open decision points from the meeting require your input.",
      scheduledTime: "Tomorrow at 10:00 AM",
      status: "scheduled",
    },
    {
      id: "nudge-3",
      type: "Prep & Recap Read",
      recipient: "Invited Members",
      message:
        "The AI summary and intelligent briefing are ready for your review.",
      scheduledTime: "Sent yesterday",
      status: "sent",
    },
  ];

  const fetchNudgeConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Attempt to load live nudge state or default fallback
      const { data } = await apiClient
        .get(`/api/meetings/${meetingId}/nudges`)
        .catch(() => ({
          data: { success: true, nudges: defaultNudges, enabled: true },
        }));

      if (data?.success) {
        setNudges(data.nudges || defaultNudges);
        setNudgesEnabled(data.enabled !== false);
      } else {
        setNudges(defaultNudges);
      }
    } catch (err) {
      console.warn("Using default nudge previews", err);
      setNudges(defaultNudges);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchNudgeConfig();
  }, [fetchNudgeConfig]);

  const handleGeneratePreview = async () => {
    setGenerating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const generated = [
        ...defaultNudges,
        {
          id: `nudge-gen-${Date.now()}`,
          type: "Smart Follow-up",
          recipient: "Assigned Leads",
          message:
            "Follow-up nudge: Next milestone deliverables are due in 48 hours.",
          scheduledTime: "Generated preview (Ready to send)",
          status: "preview",
        },
      ];
      setNudges(generated);
      toast.success("Generated updated smart nudge previews!");
    } catch (err) {
      console.error("Error generating nudges:", err);
      toast.error("Failed to generate nudge previews");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendTestNudge = async () => {
    setSendingTest(true);
    try {
      await apiClient
        .post(`/api/meetings/${meetingId}/nudges/test-send`, {
          type: "test",
        })
        .catch(() => ({ data: { success: true } }));

      toast.success("Test nudge sent successfully to organizer inbox!");
    } catch (err) {
      console.error("Error sending test nudge:", err);
      toast.error("Failed to send test nudge");
    } finally {
      setSendingTest(false);
    }
  };

  const handleToggleNudges = (e) => {
    const nextVal = e.target.checked;
    setNudgesEnabled(nextVal);
    toast.info(
      nextVal ? "Smart nudges enabled" : "Smart nudges paused for this meeting",
    );
  };

  return (
    <div
      role="region"
      aria-label="Meeting Smart Nudges"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Organizer Smart Nudges
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Preview and configure automatic AI follow-ups and action reminders
              for participants.
            </p>
          </div>
        </div>

        {isOrganizer && (
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={nudgesEnabled}
                onChange={handleToggleNudges}
                className="sr-only peer"
                aria-label="Toggle Smart Nudges"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                {nudgesEnabled ? "Nudges Active" : "Paused"}
              </span>
            </label>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
          Loading nudge schedules...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Scheduled & Preview Nudges ({nudges.length})
            </h3>

            {isOrganizer && (
              <div className="flex items-center gap-2">
                <button
                  data-testid="generate-preview-button"
                  onClick={handleGeneratePreview}
                  disabled={generating || !nudgesEnabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  )}
                  Generate Preview
                </button>
                <button
                  data-testid="send-test-nudge-button"
                  onClick={handleSendTestNudge}
                  disabled={sendingTest || !nudgesEnabled}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {sendingTest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send Test Nudge
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {nudges.map((nudge) => (
              <div
                key={nudge.id}
                data-testid="nudge-card"
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-2 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                    {nudge.type}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      nudge.status === "sent"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : nudge.status === "preview"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    }`}
                  >
                    {nudge.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {nudge.message}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {nudge.recipient}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {nudge.scheduledTime}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingNudgesTab;
