import React, { useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle2,
  ListTodo,
  AlertOctagon,
  Video,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Clock,
  Settings,
  Users,
  User,
  Share2,
} from "lucide-react";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import api from "../services/apiClient.js";

export const StandupReports = () => {
  const [activeTab, setActiveTab] = useState("my");
  const [myReports, setMyReports] = useState([]);
  const [teamReports, setTeamReports] = useState([]);
  const [preferences, setPreferences] = useState({
    scheduleType: "daily",
    timeOfDay: "09:00",
    deliveryChannels: ["in-app"],
  });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchPreferences();
    fetchMyReports();
    fetchTeamReports();
  }, []);

  const fetchMyReports = async () => {
    try {
      const res = await api.get("/api/standups/my");
      setMyReports(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch my reports", err);
    }
  };

  const fetchTeamReports = async () => {
    try {
      const res = await api.get("/api/standups/team");
      setTeamReports(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch team reports", err);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await api.get("/api/standups/preferences");
      if (res.data.data) {
        setPreferences(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch preferences", err);
    }
  };

  const handlePreferenceChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setPreferences((prev) => {
        const channels = (prev.deliveryChannels || []).filter(
          (c) => c !== name,
        );
        if (checked) channels.push(name);
        return { ...prev, deliveryChannels: channels };
      });
    } else {
      setPreferences((prev) => ({ ...prev, [name]: value }));
    }
  };

  const savePreferences = async () => {
    try {
      setLoading(true);
      await api.put("/api/standups/preferences", preferences);
      toast.success("Standup preferences saved successfully!");
    } catch (err) {
      console.error("Failed to save preferences", err);
      toast.error("Failed to save preferences.");
    } finally {
      setLoading(false);
    }
  };

  const generateManualReport = async (type = "daily") => {
    try {
      setGenerating(true);
      await api.post("/api/standups/generate", { type });
      await fetchMyReports();
      toast.success("Standup report generated successfully!");
    } catch (err) {
      console.error("Failed to generate report", err);
      toast.error("Failed to generate standup report.");
    } finally {
      setGenerating(false);
    }
  };

  const formatMarkdown = (report) => {
    const title = `### 📋 Standup (${new Date(report.date).toLocaleDateString()}) - ${report.type.toUpperCase()}`;
    const summary = report.aiSummary
      ? `\n**Summary:**\n${report.aiSummary}\n`
      : "";
    const done =
      report.completedActionItems?.length > 0
        ? `\n**✅ Done / Completed:**\n${report.completedActionItems.map((i) => `- ${i.text || i.task || i.description}`).join("\n")}\n`
        : "\n**✅ Done / Completed:**\n- None\n";
    const next =
      report.upcomingActionItems?.length > 0
        ? `\n**🎯 Today / In Progress:**\n${report.upcomingActionItems.map((i) => `- ${i.text || i.task || i.description}`).join("\n")}\n`
        : "\n**🎯 Today / In Progress:**\n- None\n";
    const blockers =
      report.blockers?.length > 0
        ? `\n**⚠️ Blockers & Risks:**\n${report.blockers.map((i) => `- ${i.text || i.task || i.description}`).join("\n")}\n`
        : "\n**⚠️ Blockers & Risks:**\n- None\n";

    return `${title}\n${summary}${done}${next}${blockers}`.trim();
  };

  const copyToClipboard = async (report, format = "markdown") => {
    const text = formatMarkdown(report);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(report._id);
      toast.success(
        format === "slack"
          ? "Copied formatted text for Slack!"
          : "Copied Standup Markdown to clipboard!",
      );
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_err) {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const renderReportCard = (report) => {
    const isCopied = copiedId === report._id;

    return (
      <div
        key={report._id}
        data-testid="standup-report-card"
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-6 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {report.user?.displayName || report.user?.name || "My"} Standup
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {report.type}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {new Date(report.date).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="copy-slack-button"
              onClick={() => copyToClipboard(report, "slack")}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy for Slack
            </button>
            <button
              type="button"
              data-testid="copy-markdown-button"
              onClick={() => copyToClipboard(report, "markdown")}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              Copy Markdown
            </button>
          </div>
        </div>

        {report.aiSummary && (
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <strong className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              AI Executive Summary
            </strong>
            <p className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {report.aiSummary}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Completed */}
          <div className="bg-white dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
            <strong className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Done ({report.completedActionItems?.length || 0})
            </strong>
            <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
              {report.completedActionItems?.length > 0 ? (
                report.completedActionItems.map((item, idx) => (
                  <li key={idx} className="truncate">
                    {item.text || item.task || item.description}
                  </li>
                ))
              ) : (
                <li className="text-slate-400 list-none italic">No items</li>
              )}
            </ul>
          </div>

          {/* Upcoming */}
          <div className="bg-white dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
            <strong className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
              <ListTodo className="w-4 h-4 text-indigo-500" />
              Today's Plan ({report.upcomingActionItems?.length || 0})
            </strong>
            <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
              {report.upcomingActionItems?.length > 0 ? (
                report.upcomingActionItems.map((item, idx) => (
                  <li key={idx} className="truncate">
                    {item.text || item.task || item.description}
                  </li>
                ))
              ) : (
                <li className="text-slate-400 list-none italic">No items</li>
              )}
            </ul>
          </div>

          {/* Blockers */}
          <div className="bg-white dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
            <strong className="block text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              Blockers ({report.blockers?.length || 0})
            </strong>
            <ul className="text-xs space-y-1 text-rose-600 dark:text-rose-400 list-disc list-inside">
              {report.blockers?.length > 0 ? (
                report.blockers.map((item, idx) => (
                  <li key={idx} className="truncate">
                    {item.text || item.task || item.description}
                  </li>
                ))
              ) : (
                <li className="text-slate-400 list-none italic">No blockers</li>
              )}
            </ul>
          </div>

          {/* Meetings */}
          <div className="bg-white dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
            <strong className="block text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Video className="w-4 h-4 text-blue-500" />
              Meetings ({report.attendedMeetings?.length || 0})
            </strong>
            <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
              {report.attendedMeetings?.length > 0 ? (
                report.attendedMeetings.map((item, idx) => (
                  <li key={idx} className="truncate">
                    {item.title || item.name}
                  </li>
                ))
              ) : (
                <li className="text-slate-400 list-none italic">No meetings</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Async Standup Reports
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automated daily & weekly standup synthesis from your action
                items
              </p>
            </div>
          </div>

          {activeTab === "my" && (
            <button
              type="button"
              data-testid="generate-standup-button"
              onClick={() => generateManualReport("daily")}
              disabled={generating}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Standup Now
                </>
              )}
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          className="flex gap-2 border-b border-slate-200 dark:border-slate-800"
        >
          <button
            role="tab"
            aria-selected={activeTab === "my"}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "my"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("my")}
          >
            <User className="w-4 h-4" />
            My Standup
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "team"}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "team"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("team")}
          >
            <Users className="w-4 h-4" />
            Team Standups
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "preferences"}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "preferences"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("preferences")}
          >
            <Settings className="w-4 h-4" />
            Preferences
          </button>
        </div>

        {/* Content */}
        {activeTab === "my" && (
          <div>
            {myReports.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 space-y-3">
                <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No personal standup reports recorded yet.
                </p>
                <button
                  onClick={() => generateManualReport("daily")}
                  className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold"
                >
                  Generate First Standup
                </button>
              </div>
            ) : (
              myReports.map(renderReportCard)
            )}
          </div>
        )}

        {activeTab === "team" && (
          <div>
            {teamReports.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No team standup reports available for this organization.
                </p>
              </div>
            ) : (
              teamReports.map(renderReportCard)
            )}
          </div>
        )}

        {activeTab === "preferences" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Automated Generation Preferences
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Schedule Type
                </label>
                <select
                  name="scheduleType"
                  value={preferences.scheduleType}
                  onChange={handlePreferenceChange}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="none">None (Manual Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Time of Day
                </label>
                <input
                  type="time"
                  name="timeOfDay"
                  value={preferences.timeOfDay}
                  onChange={handlePreferenceChange}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Delivery Channels
              </label>
              <div className="flex flex-wrap gap-4">
                {["email", "slack", "in-app"].map((channel) => (
                  <label
                    key={channel}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      name={channel}
                      checked={(preferences.deliveryChannels || []).includes(
                        channel,
                      )}
                      onChange={handlePreferenceChange}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {channel}
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={savePreferences}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandupReports;
