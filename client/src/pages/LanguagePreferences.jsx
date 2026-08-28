import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../services/apiClient.js";
import Navbar from "../components/Navbar.jsx";
import {
  Languages,
  Save,
  Plus,
  Trash2,
  Globe,
  Settings,
  AlertCircle,
  RefreshCw,
  Download,
  History,
  Award,
} from "lucide-react";
import { toast } from "react-toastify";

const LanguagePreferences = () => {
  const [preferences, setPreferences] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newGlossary, setNewGlossary] = useState({
    source: "",
    target: "",
    language: "en",
  });

  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [cacheHistory, setCacheHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [segmentQuality, setSegmentQuality] = useState(null);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const [exportFormat, setExportFormat] = useState("json");
  const [selectedExportLanguages, setSelectedExportLanguages] = useState([]);
  const [exporting, setExporting] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiClient.get("/api/translations/preferences");
      setPreferences(data.preferences || data);
    } catch (err) {
      console.error("Error fetching preferences:", err);
      setError(err.response?.data?.message || "Failed to load preferences");
      toast.error("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLanguages = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/api/translations/languages");
      setLanguages(data.languages || []);
    } catch (err) {
      console.error("Error fetching languages:", err);
    }
  }, []);

  const fetchMeetings = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/api/meetings");
      const meetingsList = Array.isArray(data?.meetings)
        ? data.meetings
        : Array.isArray(data)
          ? data
          : [];
      setMeetings(meetingsList);
    } catch (err) {
      console.error("Error fetching meetings:", err);
    }
  }, []);

  const fetchCacheHistory = useCallback(async (meetingId) => {
    if (!meetingId) return;
    try {
      setLoadingHistory(true);
      const { data } = await apiClient.get(
        `/api/translation/cache/${meetingId}`,
      );
      setCacheHistory(data?.translations || []);
    } catch (err) {
      console.error("Error fetching translation cache history:", err);
      toast.error("Failed to load translation history");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchSegmentQuality = useCallback(
    async (segmentId) => {
      if (!segmentId || !selectedMeetingId) return;
      try {
        setLoadingQuality(true);
        const { data } = await apiClient.get(
          `/api/translation/quality/${segmentId}?meetingId=${selectedMeetingId}`,
        );
        setSegmentQuality(data || null);
      } catch (err) {
        console.error("Error fetching segment quality:", err);
      } finally {
        setLoadingQuality(false);
      }
    },
    [selectedMeetingId],
  );

  const handleExport = async () => {
    if (!selectedMeetingId) return;
    try {
      setExporting(true);
      const { data } = await apiClient.post(
        `/api/translation/export/${selectedMeetingId}`,
        { format: exportFormat, languages: selectedExportLanguages },
      );

      const isJson = exportFormat === "json";
      const blob = new Blob(
        [isJson ? JSON.stringify(data, null, 2) : data.content || data],
        { type: isJson ? "application/json" : "text/plain" },
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `transcript-${selectedMeetingId}.${exportFormat}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Transcript exported successfully");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export transcript");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
    fetchLanguages();
    fetchMeetings();
  }, [fetchPreferences, fetchLanguages, fetchMeetings]);

  useEffect(() => {
    if (selectedMeetingId) {
      fetchCacheHistory(selectedMeetingId);
    } else {
      setCacheHistory([]);
    }
  }, [selectedMeetingId, fetchCacheHistory]);

  const savePreferences = async () => {
    try {
      setSaving(true);
      const { data } = await apiClient.put(
        "/api/translations/preferences",
        preferences,
      );
      setPreferences(data.preferences || data);
      toast.success("Preferences saved successfully");
    } catch (err) {
      console.error("Error saving preferences:", err);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const addGlossaryEntry = () => {
    if (!newGlossary.source || !newGlossary.target || !newGlossary.language) {
      toast.error("Please fill in all fields");
      return;
    }

    setPreferences((prev) => ({
      ...prev,
      customGlossary: [
        ...(prev.customGlossary || []),
        { ...newGlossary, addedAt: new Date().toISOString() },
      ],
    }));

    setNewGlossary({ source: "", target: "", language: "en" });
    toast.success("Glossary entry added");
  };

  const removeGlossaryEntry = (index) => {
    setPreferences((prev) => ({
      ...prev,
      customGlossary: (prev.customGlossary || []).filter((_, i) => i !== index),
    }));
    toast.success("Glossary entry removed");
  };

  const toggleLanguage = (language, type) => {
    setPreferences((prev) => {
      const key =
        type === "source" ? "defaultSourceLanguage" : "defaultTargetLanguages";

      if (type === "source") {
        return { ...prev, [key]: language };
      } else {
        const current = prev[key] || [];
        if (current.includes(language)) {
          return { ...prev, [key]: current.filter((l) => l !== language) };
        } else {
          return { ...prev, [key]: [...current, language] };
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Languages className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              Loading preferences...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 max-w-xl mx-auto px-4 py-16 flex items-center justify-center min-h-[60vh]">
          <div
            role="alert"
            className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-red-200 dark:border-red-800 p-8 text-center"
          >
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Unable to Load Preferences
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              {error ||
                "An unexpected error occurred while loading your language preferences."}
            </p>
            <button
              type="button"
              onClick={fetchPreferences}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <div className="pt-20 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <Globe className="w-8 h-8 text-blue-600" />
            Language Preferences
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Configure your translation preferences and custom glossary
          </p>
        </div>

        {/* General Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            General Settings
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  Auto-translate
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Automatically translate new segments
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.autoTranslate}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      autoTranslate: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  Show Confidence Scores
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Display translation confidence percentages
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.showConfidenceScores}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      showConfidenceScores: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Preferred Provider
              </label>
              <select
                value={preferences.preferredProvider}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    preferredProvider: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="auto">Auto (Best Available)</option>
                <option value="google">Google Translate</option>
                <option value="azure">Azure Translator</option>
              </select>
            </div>
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Language Selection
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Default Source Language
              </label>
              <select
                value={preferences.defaultSourceLanguage}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    defaultSourceLanguage: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Default Target Languages
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {languages.map((lang) => {
                  const isSelected =
                    preferences.defaultTargetLanguages?.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code, "target")}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {lang.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Custom Glossary */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            Custom Glossary
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Add custom translations for specific terms to improve accuracy
          </p>

          {/* Add New Entry */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
            <input
              type="text"
              value={newGlossary.source}
              onChange={(e) =>
                setNewGlossary((prev) => ({ ...prev, source: e.target.value }))
              }
              placeholder="Source term"
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
            <input
              type="text"
              value={newGlossary.target}
              onChange={(e) =>
                setNewGlossary((prev) => ({ ...prev, target: e.target.value }))
              }
              placeholder="Translation"
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
            <select
              value={newGlossary.language}
              onChange={(e) =>
                setNewGlossary((prev) => ({
                  ...prev,
                  language: e.target.value,
                }))
              }
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <button
              onClick={addGlossaryEntry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Add
            </button>
          </div>

          {/* Glossary Entries */}
          {preferences.customGlossary &&
          preferences.customGlossary.length > 0 ? (
            <div className="space-y-2">
              {preferences.customGlossary.map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {entry.source}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      →
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {entry.target}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">
                      {entry.language.toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => removeGlossaryEntry(index)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500 dark:text-slate-400">
              No glossary entries yet
            </p>
          )}
        </div>

        {/* Translation Audit & Management Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Translation Audit & Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Export transcripts, audit cached translations, and monitor
            translation quality scores across meetings.
          </p>

          {/* Meeting Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Meeting to Audit
            </label>
            <div className="flex gap-2">
              <select
                value={selectedMeetingId}
                onChange={(e) => {
                  setSelectedMeetingId(e.target.value);
                  setSelectedSegmentId("");
                  setSegmentQuality(null);
                }}
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                data-testid="audit-meeting-select"
              >
                <option value="">-- Choose a Meeting --</option>
                {meetings.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title} (
                    {new Date(
                      m.createdAt || m.date || Date.now(),
                    ).toLocaleDateString()}
                    )
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchMeetings}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 rounded-lg text-sm transition-colors cursor-pointer"
                title="Refresh meetings list"
                data-testid="refresh-meetings-btn"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedMeetingId ? (
            <div className="space-y-6">
              {/* Export Panel */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  Export Transcript Translations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                      Format
                    </label>
                    <div className="flex gap-2">
                      {["json", "srt"].map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setExportFormat(fmt)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            exportFormat === fmt
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-755"
                          }`}
                          data-testid={`export-format-${fmt}-btn`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                      Target Languages to Include
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg">
                      {languages.map((lang) => {
                        const isChecked = selectedExportLanguages.includes(
                          lang.code,
                        );
                        return (
                          <label
                            key={lang.code}
                            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedExportLanguages((prev) =>
                                    prev.filter((l) => l !== lang.code),
                                  );
                                } else {
                                  setSelectedExportLanguages((prev) => [
                                    ...prev,
                                    lang.code,
                                  ]);
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              data-testid={`export-lang-checkbox-${lang.code}`}
                            />
                            <span>{lang.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting || selectedExportLanguages.length === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                    data-testid="export-download-btn"
                  >
                    <Download className="w-4 h-4" />
                    {exporting ? "Exporting..." : "Export & Download"}
                  </button>
                </div>
              </div>

              {/* Cache History List */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  Translation Cache History
                </h3>
                {loadingHistory ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Loading translation memory...
                    </p>
                  </div>
                ) : cacheHistory.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: History list */}
                    <div className="lg:col-span-2 space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {cacheHistory.map((item) => (
                        <button
                          key={item._id || item.segmentId}
                          type="button"
                          onClick={() => {
                            setSelectedSegmentId(item.segmentId);
                            fetchSegmentQuality(item.segmentId);
                          }}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${
                            selectedSegmentId === item.segmentId
                              ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-350 dark:hover:border-slate-700"
                          }`}
                          data-testid={`cache-history-item-${item.segmentId}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              Segment: {item.segmentId} •{" "}
                              {item.context?.speakerName || "Unknown Speaker"}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-[10px] font-bold">
                              Score: {item.qualityScore ?? 100}%
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2">
                            {item.sourceText}
                          </p>
                          <div className="space-y-1 pl-3 border-l-2 border-slate-200 dark:border-slate-880">
                            {item.translations?.slice(0, 3).map((trans, i) => (
                              <p
                                key={i}
                                className="text-xs text-slate-600 dark:text-slate-400 truncate"
                              >
                                <span className="font-bold text-slate-500 dark:text-slate-500 uppercase mr-1">
                                  {trans.language}:
                                </span>
                                {trans.text}
                                {trans.provider === "manual" && (
                                  <span className="ml-1.5 px-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded text-[9px] font-semibold">
                                    manual
                                  </span>
                                )}
                              </p>
                            ))}
                            {item.translations?.length > 3 && (
                              <p className="text-[10px] text-slate-500 italic">
                                +{item.translations.length - 3} more
                                translations
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Right: Quality Details Panel */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                      {selectedSegmentId ? (
                        loadingQuality ? (
                          <div className="text-center py-8">
                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mx-auto mb-2" />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Loading metrics...
                            </p>
                          </div>
                        ) : segmentQuality ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Segment Quality Details
                              </h4>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white ${
                                    segmentQuality.qualityScore >= 80
                                      ? "bg-emerald-500"
                                      : segmentQuality.qualityScore >= 50
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                  }`}
                                  data-testid="segment-quality-score-badge"
                                >
                                  {segmentQuality.qualityScore}%
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Quality Index
                                  </p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
                                    Based on translation confidence & length
                                    ratios
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-center border-y border-slate-200 dark:border-slate-800 py-3 my-2">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">
                                  Access Count
                                </p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                  {segmentQuality.accessCount ?? 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">
                                  Last Accessed
                                </p>
                                <p className="text-[10px] text-slate-700 dark:text-slate-300">
                                  {segmentQuality.lastAccessedAt
                                    ? new Date(
                                        segmentQuality.lastAccessedAt,
                                      ).toLocaleTimeString()
                                    : "Never"}
                                </p>
                              </div>
                            </div>

                            <div>
                              <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                Target Translation Audits
                              </h5>
                              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {segmentQuality.translations?.map(
                                  (trans, i) => (
                                    <div
                                      key={i}
                                      className="flex flex-col p-2 bg-white dark:bg-slate-900 rounded border border-slate-150 dark:border-slate-800 text-xs"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-slate-500 dark:text-slate-400 uppercase">
                                          {trans.language}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                          Conf:{" "}
                                          {Math.round(trans.confidence * 100)}%
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                          Provider: {trans.provider}
                                        </span>
                                        {trans.corrected && (
                                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded text-[8px] font-bold">
                                            corrected
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-red-500 italic">
                            Failed to load quality details.
                          </p>
                        )
                      ) : (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-600">
                          <Award className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                          <p className="text-xs">
                            Select a history segment to audit translation
                            metrics
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-center py-8 text-slate-500 dark:text-slate-400 italic">
                    No translation history segments cached for this meeting.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-805 rounded-xl">
              <History className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-sm">
                Choose a meeting from the list to audit translations and export
                artifacts
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={savePreferences}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguagePreferences;
