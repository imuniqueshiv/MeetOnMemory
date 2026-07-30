import React, { useState, useEffect } from "react";
import apiClient from "../services/apiClient.js";
import { toast } from "react-toastify";
import {
  Loader2,
  Mail,
  CheckCircle2,
  Clock,
  Calendar,
  RefreshCw,
} from "lucide-react";

const DigestPreferences = () => {
  const [preferences, setPreferences] = useState({
    frequency: "weekly",
    deliveryDay: "Monday",
    deliveryHour: 9,
    includeSections: ["action_items", "decisions", "summaries"],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const sections = [
    { id: "summaries", label: "Meeting Summaries" },
    { id: "action_items", label: "Action Items" },
    { id: "decisions", label: "Key Decisions" },
    { id: "polls", label: "Active Polls" },
    { id: "knowledge", label: "Knowledge Updates" },
  ];

  useEffect(() => {
    fetchPreferences();
  }, []);

  useEffect(() => {
    if (!loading) {
      const debounceTimer = setTimeout(() => {
        fetchPreview();
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, loading]);

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await apiClient.get("/api/digest-preferences", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPreferences({
        frequency: data.frequency || "weekly",
        deliveryDay: data.deliveryDay || "Monday",
        deliveryHour: data.deliveryHour !== undefined ? data.deliveryHour : 9,
        includeSections: data.includeSections || [
          "action_items",
          "decisions",
          "summaries",
        ],
      });
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
      toast.error("Failed to load digest preferences");
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    try {
      setPreviewLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await apiClient.post(
        "/api/digest-preferences/preview",
        preferences,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setPreviewHtml(data.html);
    } catch (error) {
      console.error("Failed to fetch preview:", error);
      // fallback preview if error
      setPreviewHtml(
        "<div class='p-4 text-center text-red-500'>Failed to load preview</div>",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      await apiClient.put("/api/digest-preferences", preferences, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Preferences saved successfully!");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    try {
      const token = localStorage.getItem("token");
      const toastId = toast.loading("Sending test digest...");
      await apiClient.post("/api/digest-preferences/test", preferences, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.update(toastId, {
        render: "Test digest sent successfully!",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Failed to send test digest:", error);
      toast.dismiss();
      toast.error("Failed to send test digest");
    }
  };

  const toggleSection = (sectionId) => {
    setPreferences((prev) => {
      const isIncluded = prev.includeSections.includes(sectionId);
      let newSections;
      if (isIncluded) {
        newSections = prev.includeSections.filter((id) => id !== sectionId);
      } else {
        newSections = [...prev.includeSections, sectionId];
      }
      return { ...prev, includeSections: newSections };
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Settings Form */}
      <div className="flex-1 space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Delivery Schedule
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Frequency
              </label>
              <select
                value={preferences.frequency}
                onChange={(e) =>
                  setPreferences({ ...preferences, frequency: e.target.value })
                }
                className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {preferences.frequency === "weekly" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Day
                </label>
                <select
                  value={preferences.deliveryDay}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      deliveryDay: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {daysOfWeek.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Delivery Time
              </label>
              <select
                value={preferences.deliveryHour}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    deliveryHour: parseInt(e.target.value),
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {hours.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour === 0
                      ? "12:00 AM"
                      : hour < 12
                        ? `${hour}:00 AM`
                        : hour === 12
                          ? "12:00 PM"
                          : `${hour - 12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Content to Include
          </h3>
          <div className="space-y-3">
            {sections.map((section) => (
              <label
                key={section.id}
                className="flex items-center space-x-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={preferences.includeSections.includes(section.id)}
                  onChange={() => toggleSection(section.id)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {section.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save Preferences"
            )}
          </button>
          <button
            onClick={handleSendTest}
            className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium py-2 px-4 rounded-lg flex justify-center items-center gap-2 transition-colors"
          >
            <Mail className="w-4 h-4" /> Send Test
          </button>
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="flex-1">
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden h-full flex flex-col">
          <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Live Preview
            </h3>
            {previewLoading && (
              <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
            )}
          </div>
          <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-200/50 dark:bg-slate-950/50">
            {previewHtml ? (
              <div
                className="w-full max-w-[600px] shadow-sm rounded-lg"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="text-slate-400 text-sm mt-10">
                No preview available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigestPreferences;
