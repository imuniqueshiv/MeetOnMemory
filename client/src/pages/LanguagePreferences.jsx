import React, { useState, useEffect, useContext, useCallback } from "react";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import { Languages, Save, Plus, Trash2, Globe, Settings } from "lucide-react";
import { toast } from "react-toastify";

const LanguagePreferences = () => {
  const { backendUrl } = useContext(AppContent);
  const [preferences, setPreferences] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newGlossary, setNewGlossary] = useState({
    source: "",
    target: "",
    language: "en",
  });

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${backendUrl}/api/translation/preferences`,
        {
          credentials: "include",
        },
      );
      const data = await response.json();
      setPreferences(data);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      toast.error("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  const fetchLanguages = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/translation/languages`, {
        credentials: "include",
      });
      const data = await response.json();
      setLanguages(data.languages || []);
    } catch (error) {
      console.error("Error fetching languages:", error);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchPreferences();
    fetchLanguages();
  }, [fetchPreferences, fetchLanguages]);

  const savePreferences = async () => {
    try {
      setSaving(true);
      const response = await fetch(
        `${backendUrl}/api/translation/preferences`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(preferences),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }

      const data = await response.json();
      setPreferences(data);
      toast.success("Preferences saved successfully");
    } catch (error) {
      console.error("Error saving preferences:", error);
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
        ...prev.customGlossary,
        { ...newGlossary, addedAt: new Date().toISOString() },
      ],
    }));

    setNewGlossary({ source: "", target: "", language: "en" });
    toast.success("Glossary entry added");
  };

  const removeGlossaryEntry = (index) => {
    setPreferences((prev) => ({
      ...prev,
      customGlossary: prev.customGlossary.filter((_, i) => i !== index),
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

  if (loading || !preferences) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 flex items-center justify-center">
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
