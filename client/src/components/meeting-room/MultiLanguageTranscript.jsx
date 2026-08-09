import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import AppContent from "../../context/AppContent";
import { io } from "socket.io-client";
import { createClerkSocketOptions } from "../../services/apiClient.js";
import {
  Languages,
  Settings,
  Download,
  RefreshCw,
  Check,
  AlertCircle,
  Edit3,
  X,
} from "lucide-react";
import { toast } from "react-toastify";

const MultiLanguageTranscript = ({ meetingId }) => {
  const { backendUrl } = useContext(AppContent);
  const [transcript, setTranscript] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showSettings, setShowSettings] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [editText, setEditText] = useState("");
  const [languages, setLanguages] = useState([]);
  const socketRef = useRef(null);
  const transcriptRef = useRef(null);

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

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch(
        `${backendUrl}/api/translation/preferences`,
        {
          credentials: "include",
        },
      );
      const data = await response.json();
      if (
        data.defaultTargetLanguages &&
        data.defaultTargetLanguages.length > 0
      ) {
        setSelectedLanguage(data.defaultTargetLanguages[0]);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    }
  }, [backendUrl]);

  const fetchTranscript = useCallback(async () => {
    try {
      const response = await fetch(
        `${backendUrl}/api/translation/cache/${meetingId}`,
        {
          credentials: "include",
        },
      );
      const data = await response.json();
      setTranscript(data.translations || []);
    } catch (error) {
      console.error("Error fetching transcript:", error);
    }
  }, [backendUrl, meetingId]);

  const connectSocket = useCallback(async () => {
    try {
      const opts = await createClerkSocketOptions({
        transports: ["websocket"],
      });
      const socket = io(backendUrl, opts);
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("✓ Translation socket connected");
      });

      socket.on("translation:result", (data) => {
        setTranscript((prev) => {
          const existing = prev.findIndex(
            (t) => t.segmentId === data.segmentId,
          );
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing].translations =
              updated[existing].translations || [];
            const transIndex = updated[existing].translations.findIndex(
              (t) => t.language === data.targetLanguage,
            );
            if (transIndex >= 0) {
              updated[existing].translations[transIndex] = data;
            } else {
              updated[existing].translations.push(data);
            }
            return updated;
          }
          return [
            ...prev,
            {
              segmentId: data.segmentId,
              sourceLanguage: data.sourceLanguage,
              translations: [data],
            },
          ];
        });
      });

      socket.on("translation:error", (data) => {
        console.error("Translation error:", data);
        toast.error("Translation failed");
      });

      socket.on("translation:correction", (data) => {
        setTranscript((prev) =>
          prev.map((t) => {
            if (t.segmentId === data.segmentId) {
              return {
                ...t,
                translations: t.translations.map((tr) =>
                  tr.language === data.language
                    ? { ...tr, text: data.correctedText, provider: "manual" }
                    : tr,
                ),
              };
            }
            return t;
          }),
        );
        toast.success("Translation corrected");
      });
    } catch (error) {
      console.error("Socket connection error:", error);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchLanguages();
    fetchPreferences();
    fetchTranscript();
    connectSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [fetchLanguages, fetchPreferences, fetchTranscript, connectSocket]);

  const requestTranslation = (
    segmentId,
    sourceText,
    sourceLanguage,
    targetLanguage,
  ) => {
    if (!socketRef.current) return;

    socketRef.current.emit("translation:request", {
      meetingId,
      segmentId,
      sourceText,
      sourceLanguage,
      targetLanguage,
      context: {
        timestamp: Date.now(),
      },
    });
  };

  const handleLanguageChange = (language) => {
    setSelectedLanguage(language);

    // Request translations for segments that don't have this language yet
    transcript.forEach((segment) => {
      const hasTranslation = segment.translations?.some(
        (t) => t.language === language,
      );
      if (!hasTranslation && segment.sourceText) {
        requestTranslation(
          segment.segmentId,
          segment.sourceText,
          segment.sourceLanguage,
          language,
        );
      }
    });

    if (socketRef.current) {
      socketRef.current.emit("translation:language-change", {
        meetingId,
        language,
      });
    }
  };

  const handleCorrection = (segmentId, language) => {
    setEditingSegment({ segmentId, language });
    const segment = transcript.find((t) => t.segmentId === segmentId);
    const translation = segment?.translations?.find(
      (t) => t.language === language,
    );
    setEditText(translation?.text || "");
  };

  const submitCorrection = async () => {
    if (!editingSegment || !editText.trim()) return;

    try {
      const response = await fetch(`${backendUrl}/api/translation/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          meetingId,
          segmentId: editingSegment.segmentId,
          language: editingSegment.language,
          correctedText: editText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit correction");
      }

      setEditingSegment(null);
      setEditText("");
      toast.success("Correction submitted");
    } catch (error) {
      console.error("Error submitting correction:", error);
      toast.error("Failed to submit correction");
    }
  };

  const exportTranscript = async (format) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/translation/export/${meetingId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            format,
            languages: [selectedLanguage],
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      if (format === "json") {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcript-${meetingId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "srt") {
        const text = await response.text();
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcript-${meetingId}.srt`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`Transcript exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Error exporting transcript:", error);
      toast.error("Failed to export transcript");
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.6) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getProviderBadge = (provider) => {
    const colors = {
      google:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      azure:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      manual:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      cache: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
      fallback:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    };
    return colors[provider] || colors.cache;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Languages className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Multi-Language Transcript
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={fetchTranscript}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Language Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Display Language
        </label>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedLanguage === lang.code
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Export Options
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => exportTranscript("json")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Download className="w-4 h-4 inline mr-2" />
              Export JSON
            </button>
            <button
              onClick={() => exportTranscript("srt")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Download className="w-4 h-4 inline mr-2" />
              Export SRT
            </button>
          </div>
        </div>
      )}

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="space-y-4 max-h-[600px] overflow-y-auto"
      >
        {transcript.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Languages className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No transcript available yet</p>
          </div>
        ) : (
          transcript.map((segment) => {
            const translation = segment.translations?.find(
              (t) => t.language === selectedLanguage,
            );

            return (
              <div
                key={segment.segmentId}
                className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                {/* Source Text */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Source ({segment.sourceLanguage.toUpperCase()})
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {segment.sourceText}
                  </p>
                </div>

                {/* Translation */}
                {translation ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Translation ({selectedLanguage.toUpperCase()})
                        </span>
                        <span
                          className={`text-xs font-medium ${getConfidenceColor(
                            translation.confidence,
                          )}`}
                        >
                          {Math.round(translation.confidence * 100)}% confidence
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getProviderBadge(
                            translation.provider,
                          )}`}
                        >
                          {translation.provider}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleCorrection(segment.segmentId, selectedLanguage)
                        }
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Correct translation"
                      >
                        <Edit3 className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-900 dark:text-white font-medium">
                      {translation.text}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        requestTranslation(
                          segment.segmentId,
                          segment.sourceText,
                          segment.sourceLanguage,
                          selectedLanguage,
                        )
                      }
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Translate to {selectedLanguage.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Correction Modal */}
      {editingSegment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Correct Translation
              </h3>
              <button
                onClick={() => {
                  setEditingSegment(null);
                  setEditText("");
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Corrected Text ({editingSegment.language.toUpperCase()})
                </label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  rows={4}
                  placeholder="Enter corrected translation..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingSegment(null);
                    setEditText("");
                  }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCorrection}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Submit Correction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiLanguageTranscript;
