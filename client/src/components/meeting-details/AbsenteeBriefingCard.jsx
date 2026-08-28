import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  CheckCircle2,
  ListTodo,
  Scale,
  MessageSquare,
  Loader2,
  RefreshCw,
  Eye,
} from "lucide-react";
import { toast } from "react-toastify";
import { absenteeCatchUpApi } from "../../api/absenteeCatchUpApi";

const AbsenteeBriefingCard = ({ meetingId }) => {
  const [catchUp, setCatchUp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchBriefing = useCallback(async () => {
    if (!meetingId) return;
    try {
      setLoading(true);
      const data = await absenteeCatchUpApi.getMeetingCatchUp(meetingId);
      if (data.success && data.catchUp) {
        setCatchUp(data.catchUp);
      } else {
        setCatchUp(null);
      }
    } catch (err) {
      console.error("Error fetching absentee briefing:", err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const data = await absenteeCatchUpApi.generateMeetingCatchUp(meetingId);
      if (data.success && data.catchUp) {
        setCatchUp(data.catchUp);
        toast.success("Catch-up briefing generated successfully!");
      }
    } catch (err) {
      console.error("Error generating catch-up:", err);
      toast.error(
        err.response?.data?.message || "Failed to generate catch-up briefing",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!catchUp || catchUp.status === "read") return;
    try {
      await absenteeCatchUpApi.markAsRead(catchUp._id);
      setCatchUp({ ...catchUp, status: "read" });
      toast.success("Briefing marked as read");
    } catch (err) {
      console.error("Error marking briefing read:", err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6 text-center text-xs text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
        Checking personalized catch-up status...
      </div>
    );
  }

  const content = catchUp?.content || {};
  const isRead = catchUp?.status === "read";

  return (
    <div
      aria-label="Absentee Catch-Up Briefing Card"
      className="bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-indigo-100 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-sm space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-100/60 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Absentee Catch-Up Briefing
              </h3>
              {catchUp && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isRead
                      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  {isRead ? "Read" : "New Briefing"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personalized AI executive catch-up briefing tailored for you
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {catchUp ? (
            <>
              {!isRead && (
                <button
                  type="button"
                  onClick={handleMarkAsRead}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Mark as Read
                </button>
              )}
              <button
                type="button"
                data-testid="regenerate-catchup-button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`}
                />
                Regenerate
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="generate-catchup-button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Catch-Up Briefing
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Briefing Content */}
      {catchUp ? (
        <div className="space-y-4 pt-1">
          {/* Executive Overview */}
          {content.overview && (
            <div className="bg-white/80 dark:bg-slate-800/60 p-4 rounded-xl border border-indigo-50 dark:border-slate-800/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-500" />
                Executive Summary
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {content.overview}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Delegated Action Items */}
            <div className="bg-white/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-indigo-50 dark:border-slate-800/80 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Your Action Items ({content.actionItems?.length || 0})
              </h4>
              {content.actionItems && content.actionItems.length > 0 ? (
                <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside">
                  {content.actionItems.map((item, idx) => (
                    <li key={idx} className="leading-normal">
                      {typeof item === "string"
                        ? item
                        : item.task || item.description}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No action items assigned to you.
                </p>
              )}
            </div>

            {/* Key Decisions */}
            <div className="bg-white/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-indigo-50 dark:border-slate-800/80 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Key Decisions Made ({content.decisions?.length || 0})
              </h4>
              {content.decisions && content.decisions.length > 0 ? (
                <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside">
                  {content.decisions.map((dec, idx) => (
                    <li key={idx} className="leading-normal">
                      {typeof dec === "string"
                        ? dec
                        : dec.decision || dec.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No major decisions recorded.
                </p>
              )}
            </div>

            {/* Direct Mentions */}
            <div className="bg-white/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-indigo-50 dark:border-slate-800/80 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Topic & Name Mentions ({content.mentions?.length || 0})
              </h4>
              {content.mentions && content.mentions.length > 0 ? (
                <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside">
                  {content.mentions.map((men, idx) => (
                    <li key={idx} className="leading-normal">
                      {typeof men === "string" ? men : men.context || men.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No direct mentions during the session.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Missed this meeting? Generate a personalized catch-up briefing with
            action items, key decisions, and mentions.
          </p>
        </div>
      )}
    </div>
  );
};

export default AbsenteeBriefingCard;
