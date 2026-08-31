import React, { useContext, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import { toast } from "react-toastify";
import {
  getLatestInsight,
  triggerManualGeneration,
  getInsightHistory,
  shareWeeklyInsight,
  emailWeeklyInsight,
} from "../services/weeklyInsightApi.js";
import { useRBAC } from "../hooks/useRBAC.js";
import {
  Loader2,
  Zap,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Briefcase,
  Sparkles,
  Share2,
  Mail,
} from "lucide-react";
import { Link } from "react-router-dom";

const WeeklyInsights = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useContext(AppContent);
  const { userRole } = useRBAC();
  const isAdmin = userRole === "admin" || userRole === "owner";

  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedInsightId, setSelectedInsightId] = useState("");
  const [sharing, setSharing] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!activeOrganization) return;
    try {
      const data = await getInsightHistory(activeOrganization._id, 1, 50);
      setHistory(data.insights || []);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  }, [activeOrganization]);

  const fetchInsight = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLatestInsight(activeOrganization._id);
      setInsight(data);
      if (data) {
        setSelectedInsightId(data._id);
      }
    } catch (error) {
      console.error("Failed to fetch latest insight:", error);
      toast.error(t("weeklyInsights.fetchError", "Failed to load insights."));
    } finally {
      setLoading(false);
    }
  }, [activeOrganization, t]);

  useEffect(() => {
    if (activeOrganization) {
      fetchInsight();
      fetchHistory();
    }
  }, [activeOrganization, fetchInsight, fetchHistory]);

  const handleSelectInsight = (e) => {
    const id = e.target.value;
    setSelectedInsightId(id);
    const selected = history.find((h) => h._id === id);
    if (selected) {
      setInsight(selected);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await triggerManualGeneration(activeOrganization._id);
      setInsight(data);
      if (data) {
        setSelectedInsightId(data._id);
      }
      toast.success(
        t("weeklyInsights.generated", "Weekly insight generated successfully."),
      );
      await fetchHistory();
    } catch (error) {
      console.error("Failed to generate insight:", error);
      toast.error(
        t("weeklyInsights.generateError", "Failed to generate insight."),
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!insight) return;
    setSharing(true);
    try {
      const response = await shareWeeklyInsight(
        activeOrganization._id,
        insight._id,
      );
      if (response && response.shareLink) {
        await navigator.clipboard.writeText(response.shareLink);
        toast.success(
          t("weeklyInsights.shared", "Share link copied to clipboard!"),
        );
      }
    } catch (error) {
      console.error("Failed to share insight:", error);
      toast.error(
        t("weeklyInsights.shareError", "Failed to generate share link."),
      );
    } finally {
      setSharing(false);
    }
  };

  const handleEmail = async () => {
    if (!insight) return;
    setEmailing(true);
    try {
      await emailWeeklyInsight(activeOrganization._id, insight._id);
      toast.success(
        t(
          "weeklyInsights.emailed",
          "Weekly digest emailed to all active members successfully!",
        ),
      );
    } catch (error) {
      console.error("Failed to email insight:", error);
      toast.error(
        t("weeklyInsights.emailError", "Failed to send email digest."),
      );
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Weekly Insights Digest
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              AI-powered analysis of your organization's meetings over the past
              7 days.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* History Selector */}
            {history.length > 0 && (
              <select
                value={selectedInsightId || ""}
                onChange={handleSelectInsight}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {history.map((h) => {
                  const dateLabel = `${new Date(
                    h.startDate,
                  ).toLocaleDateString()} - ${new Date(
                    h.endDate,
                  ).toLocaleDateString()}`;
                  return (
                    <option key={h._id} value={h._id}>
                      {dateLabel}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Share CTA */}
            {insight && (
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex items-center justify-center p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 transition-colors disabled:opacity-50"
                title={t("weeklyInsights.share", "Copy share link")}
              >
                {sharing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Email Digest CTA (Admin Only) */}
            {insight && isAdmin && (
              <button
                onClick={handleEmail}
                disabled={emailing}
                className="flex items-center justify-center p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 transition-colors disabled:opacity-50"
                title={t("weeklyInsights.emailDigest", "Send email digest")}
              >
                {emailing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Generate CTA */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Generate Now
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin w-8 h-8 text-indigo-500" />
          </div>
        ) : !insight ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-800">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              No Insights Yet
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Generate an insight to see cross-meeting patterns and stalled
              action items.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* AI Summary */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-indigo-500" />
                Strategic Summary
              </h2>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {insight.aiSummary}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recurring Topics */}
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                  Recurring Topics
                </h3>
                {insight.recurringTopics?.length > 0 ? (
                  <ul className="space-y-4">
                    {insight.recurringTopics.map((topic, i) => (
                      <li key={i} className="border-l-2 border-blue-500 pl-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {topic.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {topic.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No significant recurring topics detected.
                  </p>
                )}
              </div>

              {/* Stalled Action Items */}
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
                  Stalled Action Items
                </h3>
                {insight.stalledActionItems?.length > 0 ? (
                  <ul className="space-y-3">
                    {insight.stalledActionItems.map((item, i) => (
                      <li
                        key={i}
                        className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3"
                      >
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {item.text}
                        </p>
                        {item.meetingId && (
                          <Link
                            to={`/meeting/${item.meetingId._id || item.meetingId}`}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block"
                          >
                            View Source Meeting
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No stalled action items detected.
                  </p>
                )}
              </div>

              {/* Decision Conflicts */}
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                  Decision Conflicts
                </h3>
                {insight.decisionConflicts?.length > 0 ? (
                  <ul className="space-y-3">
                    {insight.decisionConflicts.map((conflict, i) => (
                      <li
                        key={i}
                        className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3"
                      >
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {conflict.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No apparent decision conflicts detected.
                  </p>
                )}
              </div>
            </div>

            {/* Participation Trends */}
            {insight.participationTrends && (
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Participation Trends
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  {insight.participationTrends}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyInsights;
