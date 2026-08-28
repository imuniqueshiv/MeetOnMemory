import React, {
  useEffect,
  useState,
  useCallback,
  useContext,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import api from "../services/apiClient.js";
import { speakerMappingApi } from "../services/speakerMappingApi.js";
import { requestTranscriptBulkTranslation } from "../services/translationApi.js";
import {
  FileText,
  Search,
  Download,
  ArrowLeft,
  Clock,
  Users,
  Calendar,
  X,
  Sparkles,
  Edit2,
  Check,
  Loader2,
  Lock,
  Key,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";
import MeetingSentimentChart from "../components/MeetingSentimentChart";
import SpeakerAttribution from "../components/meeting-details/SpeakerAttribution";
import TranscriptTimelineScrubber from "../components/meeting-details/TranscriptTimelineScrubber";
import E2EEKeyManagementModal from "../components/E2EEKeyManagementModal.jsx";
import AppContent from "../context/AppContent.js";

const HighlightedText = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-300 text-black">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
};

const TranscriptViewer = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [highlightedSegment, setHighlightedSegment] = useState(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const mediaSeekRef = useRef(null);

  const [isEncrypted, setIsEncrypted] = useState(false);
  const [keyMissing, setKeyMissing] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const { userData } = useContext(AppContent) || {};
  const [editingSpeakerIndex, setEditingSpeakerIndex] = useState(null);
  const [newSpeakerName, setNewSpeakerName] = useState("");

  const [targetLang, setTargetLang] = useState("es");
  const [translationStatus, setTranslationStatus] = useState("idle");
  const [translatedText, setTranslatedText] = useState("");

  const [editingSegmentIndex, setEditingSegmentIndex] = useState(null);
  const [editSegmentText, setEditSegmentText] = useState("");
  const [editSegmentStartTime, setEditSegmentStartTime] = useState("");
  const [editSegmentEndTime, setEditSegmentEndTime] = useState("");
  const [isSavingSegment, setIsSavingSegment] = useState(false);

  const parseTimestampToSeconds = (timeStr) => {
    if (typeof timeStr === "number") return timeStr;
    if (!timeStr) return 0;
    const parts = String(timeStr).trim().split(":");
    if (parts.length === 2) {
      const mins = Number(parts[0]);
      const secs = Number(parts[1]);
      return isNaN(mins) || isNaN(secs) ? NaN : mins * 60 + secs;
    }
    if (parts.length === 3) {
      const hrs = Number(parts[0]);
      const mins = Number(parts[1]);
      const secs = Number(parts[2]);
      return isNaN(hrs) || isNaN(mins) || isNaN(secs)
        ? NaN
        : hrs * 3600 + mins * 60 + secs;
    }
    const num = Number(timeStr);
    return isNaN(num) ? NaN : num;
  };

  const startEditSegment = (index, segment) => {
    setEditingSegmentIndex(index);
    setEditSegmentText(segment.text || "");
    setEditSegmentStartTime(formatTimestamp(segment.startTime || 0));
    setEditSegmentEndTime(formatTimestamp(segment.endTime || 0));
  };

  const handleCancelEditSegment = () => {
    setEditingSegmentIndex(null);
    setEditSegmentText("");
    setEditSegmentStartTime("");
    setEditSegmentEndTime("");
  };

  const handleSaveSegment = async (index) => {
    const startSec = parseTimestampToSeconds(editSegmentStartTime);
    const endSec = parseTimestampToSeconds(editSegmentEndTime);

    if (isNaN(startSec) || startSec < 0) {
      toast.error("Start time must be a valid timestamp (MM:SS or seconds)");
      return;
    }
    if (isNaN(endSec) || endSec < 0) {
      toast.error("End time must be a valid timestamp (MM:SS or seconds)");
      return;
    }
    if (endSec < startSec) {
      toast.error("End time cannot be less than start time");
      return;
    }
    if (!editSegmentText.trim()) {
      toast.error("Segment text cannot be empty");
      return;
    }

    setIsSavingSegment(true);
    try {
      const targetId = transcript?._id || meetingId;
      await api.patch(`/api/transcripts/${targetId}/segments/${index}`, {
        text: editSegmentText.trim(),
        startTime: startSec,
        endTime: endSec,
      });

      toast.success("Transcript segment updated successfully");
      setTranscript((prev) => {
        if (!prev || !prev.segments) return prev;
        const updatedSegments = [...prev.segments];
        updatedSegments[index] = {
          ...updatedSegments[index],
          text: editSegmentText.trim(),
          startTime: startSec,
          endTime: endSec,
          isEdited: true,
          editedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          segments: updatedSegments,
          fullText: updatedSegments.map((s) => s.text).join(" "),
        };
      });
      setEditingSegmentIndex(null);
    } catch (err) {
      console.error("Error updating segment:", err);
      toast.error(err.response?.data?.message || "Failed to update segment");
    } finally {
      setIsSavingSegment(false);
    }
  };

  const handleTriggerTranslation = async () => {
    setTranslationStatus("translating");
    try {
      const data = await requestTranscriptBulkTranslation(
        meetingId,
        targetLang,
      );
      if (data && data.success) {
        setTranslatedText(data.translatedText);
        setTranslationStatus("translated");
      } else {
        setTranslationStatus("failed");
      }
    } catch (err) {
      console.error("Translation error:", err);
      setTranslationStatus("failed");
    }
  };

  const handleResetToOriginal = () => {
    setTranslationStatus("idle");
    setTranslatedText("");
  };

  const fetchTranscript = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/transcripts/meeting/${meetingId}`);

      const data = response.data?.data || response.data;
      if (data && data.segments) {
        data.segments = data.segments.filter(
          (segment, index, self) =>
            index ===
            self.findIndex(
              (s) =>
                s.startTime === segment.startTime &&
                s.text === segment.text &&
                s.speaker === segment.speaker,
            ),
        );
      }

      // Issue #1335 & #2030 — decrypt ciphertext locally when E2EE payload is present
      if (data?.encryption?.enabled && data.encryption.encryptedTranscript) {
        setIsEncrypted(true);
        try {
          const { loadMeetingKey, importKey, decryptTranscript } =
            await import("../utils/encryption/index.js");
          const stored = loadMeetingKey(meetingId);
          if (!stored) {
            setKeyMissing(true);
            toast.warn(
              "E2EE Meeting key not found in this browser. Please import key to decrypt.",
            );
          } else {
            setKeyMissing(false);
            const key = await importKey(stored);
            const plaintext = await decryptTranscript(
              data.encryption.encryptedTranscript,
              key,
            );
            data.fullText = plaintext;
            if (!data.segments?.length) {
              data.segments = [
                {
                  text: plaintext,
                  speaker: "Transcript",
                  startTime: 0,
                  endTime: 0,
                },
              ];
            }
          }
        } catch (decryptErr) {
          console.error("E2EE decrypt failed:", decryptErr);
          setKeyMissing(true);
          toast.error("Failed to decrypt transcript with local key");
        }
      } else {
        setIsEncrypted(false);
        setKeyMissing(false);
      }

      setTranscript(data);
    } catch (error) {
      console.error("Error fetching transcript:", error);
      toast.error("Failed to load transcript");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  const handleSpeakerChange = async (index, oldSpeaker) => {
    if (!newSpeakerName.trim()) return;

    try {
      // Use the new Speaker Mapping API
      await speakerMappingApi.saveAndApplyMapping(
        meetingId,
        oldSpeaker,
        newSpeakerName.trim(),
      );

      toast.success("Speaker mapped successfully");
      // Refresh transcript fully to ensure UI sync
      fetchTranscript();
    } catch (error) {
      console.error("Error updating speaker:", error);
      toast.error(error.response?.data?.message || "Failed to update speaker");
    } finally {
      setEditingSpeakerIndex(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.post(
        `/api/transcripts/meeting/${meetingId}/search`,
        { query: searchQuery },
      );

      setSearchResults(response.data.matches || []);
    } catch (error) {
      console.error("Error searching transcript:", error);
      toast.error("Search failed");
    }
  };

  const handleExportText = async () => {
    try {
      const response = await api.get(
        `/api/transcripts/meeting/${meetingId}/export/text`,
        {
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `transcript-${meetingId}.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Transcript exported as text");
    } catch (error) {
      console.error("Error exporting transcript:", error);
      toast.error("Export failed");
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await api.get(
        `/api/transcripts/meeting/${meetingId}/export/pdf`,
        {
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `transcript-${meetingId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Transcript exported as PDF");
    } catch (error) {
      console.error("Error exporting transcript:", error);
      toast.error("Export failed");
    }
  };

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const scrollToSegment = (index, { seek = false } = {}) => {
    if (index == null || index < 0) return;
    setHighlightedSegment(index);
    const element = document.getElementById(`segment-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedSegment(null), 3000);
    }
    if (seek && transcript?.segments?.[index]) {
      mediaSeekRef.current?.(transcript.segments[index].startTime || 0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Loading transcript...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center">
            <FileText size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Transcript Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              No transcript available for this meeting
            </p>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const meeting = transcript.meeting;

  const activePlaybackSegment = (() => {
    const segs = transcript.segments || [];
    if (!segs.length) return null;
    const idx = segs.findIndex((s) => {
      const start = s.startTime || 0;
      const end = s.endTime ?? start + 0.25;
      return playbackTime >= start && playbackTime < end;
    });
    return idx >= 0 ? idx : null;
  })();

  const canEdit =
    userData &&
    meeting &&
    (userData.role === "admin" ||
      userData.role === "owner" ||
      (meeting.uploadedBy && meeting.uploadedBy === userData._id) ||
      (meeting.uploadedBy && meeting.uploadedBy._id === userData._id));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="pt-16">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 sticky top-16 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ArrowLeft
                    size={20}
                    className="text-gray-600 dark:text-gray-400"
                  />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                      {meeting?.title || "Meeting Transcript"}
                    </h1>
                    {isEncrypted && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded">
                        <Lock size={12} /> E2EE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {meeting?.date
                        ? new Date(meeting.date).toLocaleDateString()
                        : "N/A"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {Math.floor(transcript.duration / 60)}:
                      {Math.floor(transcript.duration % 60)
                        .toString()
                        .padStart(2, "0")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {transcript.segments?.length || 0} segments
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEncrypted && (
                  <button
                    onClick={() => setShowKeyModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800/50 transition-colors"
                  >
                    <Key size={14} />
                    <span>Manage Keys</span>
                  </button>
                )}
                <button
                  onClick={handleExportText}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  title="Export as text"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">TXT</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  title="Export as PDF"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Search
              </button>
            </div>

            {/* Language Selector Controls */}
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Bulk Translation
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  disabled={translationStatus === "translating"}
                  className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-semibold focus:outline-none"
                >
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="zh">Chinese (中文)</option>
                  <option value="de">German (Deutsch)</option>
                </select>

                {translationStatus === "translated" ? (
                  <button
                    onClick={handleResetToOriginal}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition"
                  >
                    ↩️ Show Original
                  </button>
                ) : (
                  <button
                    onClick={handleTriggerTranslation}
                    disabled={translationStatus === "translating"}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition disabled:opacity-40"
                  >
                    {translationStatus === "translating"
                      ? "Translating..."
                      : "Translate"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <SpeakerAttribution
              meetingId={meetingId}
              participants={meeting?.participants}
              onMappingChange={fetchTranscript}
            />
          </div>

          <TranscriptTimelineScrubber
            meetingId={meetingId}
            meeting={meeting}
            transcript={transcript}
            onCurrentTimeChange={setPlaybackTime}
            seekRef={mediaSeekRef}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Transcript Content */}
            <div className="lg:col-span-2 space-y-4">
              {keyMissing && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">
                        Decryption Key Required
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                        This meeting is end-to-end encrypted. The server does
                        not store the encryption key. Import the meeting key
                        backup file or paste the key from an attendee to view
                        plaintext.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowKeyModal(true)}
                    className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow transition"
                  >
                    Import Key
                  </button>
                </div>
              )}

              {/* Sentiment Chart */}
              {translationStatus !== "translated" && (
                <MeetingSentimentChart
                  transcript={transcript}
                  onPointClick={(segmentData) => {
                    const index = transcript.segments.findIndex(
                      (s) => s.startTime === segmentData.startTime,
                    );
                    if (index !== -1) {
                      scrollToSegment(index);
                    }
                  }}
                />
              )}

              {/* Operational Alert Messaging Feedback */}
              {translationStatus === "translating" && (
                <div className="mb-4 text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
                  Processing bulk text blocks. Please wait...
                </div>
              )}

              {translationStatus === "failed" && (
                <div className="mb-4 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-200 dark:border-red-900/40">
                  ⚠️ Translation Failure: Downstream service timed out. Please
                  try again.
                </div>
              )}

              {translationStatus === "translated" ? (
                <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 relative">
                  <span className="absolute top-3 right-3 text-[9px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 px-2 py-0.5 rounded-md">
                    ✨ AI Translation Implemented
                  </span>
                  <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-line font-serif">
                    {translatedText ||
                      "No transcript text content currently compiled."}
                  </p>
                </div>
              ) : transcript.segments?.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-8 text-center">
                  <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No transcript segments available
                  </p>
                </div>
              ) : (
                transcript.segments.map((segment, index) => (
                  <div
                    key={index}
                    id={`segment-${index}`}
                    role={editingSegmentIndex === index ? undefined : "button"}
                    tabIndex={editingSegmentIndex === index ? undefined : 0}
                    onClick={() => {
                      if (editingSegmentIndex === index) return;
                      scrollToSegment(index, { seek: true });
                    }}
                    onKeyDown={(e) => {
                      if (editingSegmentIndex === index) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        scrollToSegment(index, { seek: true });
                      }
                    }}
                    className={`bg-white dark:bg-slate-800 rounded-lg p-4 border ${
                      editingSegmentIndex === index
                        ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800"
                        : `cursor-pointer ${
                            highlightedSegment === index ||
                            activePlaybackSegment === index
                              ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20"
                              : "border-gray-200 dark:border-gray-700"
                          }`
                    } transition-all`}
                  >
                    {editingSegmentIndex === index ? (
                      /* Inline Segment Editor Mode */
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              Editing Segment #{index + 1}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded">
                              {segment.speaker || "Speaker"}
                            </span>
                          </div>

                          {/* Timestamp Inputs */}
                          <div className="flex items-center gap-2 text-xs">
                            <Clock size={12} className="text-gray-400" />
                            <label className="text-gray-500 dark:text-gray-400 text-xs flex items-center">
                              Start:
                              <input
                                type="text"
                                aria-label="Start time"
                                value={editSegmentStartTime}
                                onChange={(e) =>
                                  setEditSegmentStartTime(e.target.value)
                                }
                                placeholder="00:00"
                                className="ml-1 px-1.5 py-0.5 w-16 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-800 dark:text-gray-200"
                              />
                            </label>
                            <label className="text-gray-500 dark:text-gray-400 text-xs flex items-center">
                              End:
                              <input
                                type="text"
                                aria-label="End time"
                                value={editSegmentEndTime}
                                onChange={(e) =>
                                  setEditSegmentEndTime(e.target.value)
                                }
                                placeholder="00:00"
                                className="ml-1 px-1.5 py-0.5 w-16 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-800 dark:text-gray-200"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Segment Textarea */}
                        <div>
                          <textarea
                            rows={3}
                            aria-label="Segment text"
                            className="w-full p-2.5 bg-white dark:bg-slate-700 border border-indigo-300 dark:border-indigo-600 rounded-md text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed resize-y"
                            value={editSegmentText}
                            onChange={(e) => setEditSegmentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                (e.ctrlKey || e.metaKey) &&
                                e.key === "Enter"
                              ) {
                                e.preventDefault();
                                handleSaveSegment(index);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                handleCancelEditSegment();
                              }
                            }}
                            autoFocus
                          />
                        </div>

                        {/* Editor Actions */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-gray-400">
                            Press{" "}
                            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-gray-600 text-[10px]">
                              Ctrl+Enter
                            </kbd>{" "}
                            to save,{" "}
                            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-gray-600 text-[10px]">
                              Esc
                            </kbd>{" "}
                            to cancel
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEditSegment}
                              disabled={isSavingSegment}
                              className="px-3 py-1.5 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-md flex items-center gap-1 transition-colors"
                            >
                              <X size={12} />
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveSegment(index)}
                              disabled={isSavingSegment}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                            >
                              {isSavingSegment ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              Save Changes
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Normal Segment View */
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {editingSpeakerIndex === index ? (
                              <div className="flex items-center gap-2 relative">
                                <input
                                  type="text"
                                  className="px-2 py-1 bg-white dark:bg-slate-700 border border-indigo-300 rounded text-xs text-gray-800 dark:text-gray-200"
                                  value={newSpeakerName}
                                  onChange={(e) =>
                                    setNewSpeakerName(e.target.value)
                                  }
                                  list="participants-list"
                                  autoFocus
                                />
                                <datalist id="participants-list">
                                  {meeting?.participants?.map((p, i) => (
                                    <option key={i} value={p.name} />
                                  ))}
                                </datalist>
                                <div className="flex items-center gap-1">
                                  <label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 cursor-pointer">
                                    Map all '{segment.speaker}' globally
                                  </label>
                                </div>
                                <button
                                  onClick={() =>
                                    handleSpeakerChange(index, segment.speaker)
                                  }
                                  className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingSpeakerIndex(null)}
                                  className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canEdit) {
                                    setEditingSpeakerIndex(index);
                                    setNewSpeakerName(segment.speaker);
                                  }
                                }}
                                className={`px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded ${canEdit ? "cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors" : ""}`}
                                title={canEdit ? "Click to edit speaker" : ""}
                              >
                                {segment.speaker || "Speaker"}
                                {canEdit && (
                                  <Edit2
                                    size={10}
                                    className="inline ml-1 opacity-50"
                                  />
                                )}
                              </span>
                            )}
                            <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1">
                              <Clock size={11} className="inline opacity-70" />
                              {formatTimestamp(segment.startTime)}
                              {segment.endTime > segment.startTime &&
                                ` - ${formatTimestamp(segment.endTime)}`}
                            </span>
                            {segment.isEdited && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium"
                                title={
                                  segment.editedAt
                                    ? `Edited at ${new Date(segment.editedAt).toLocaleString()}`
                                    : "Edited"
                                }
                              >
                                Edited
                              </span>
                            )}
                          </div>

                          {/* Edit segment button */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditSegment(index, segment);
                              }}
                              className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs flex items-center gap-1 transition-colors"
                              title="Edit segment text and timestamps"
                              aria-label="Edit segment"
                            >
                              <Edit2 size={12} />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                          <HighlightedText
                            text={segment.text}
                            query={searchQuery}
                          />
                        </p>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Search Results Sidebar */}
            {searchResults.length > 0 && (
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 sticky top-40">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Sparkles size={18} className="text-indigo-600" />
                      Search Results
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {searchResults.length} matches
                    </span>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          scrollToSegment(transcript.segments.indexOf(result))
                        }
                        className="w-full text-left p-3 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            {result.speaker || "Speaker"}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimestamp(result.startTime)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {result.text}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <E2EEKeyManagementModal
          isOpen={showKeyModal}
          onClose={() => setShowKeyModal(false)}
          meeting={{
            _id: meetingId,
            title: transcript?.meetingId?.title || "Meeting",
            encryptedTranscript: transcript?.encryption?.encryptedTranscript,
            encryption: transcript?.encryption,
          }}
          onKeyImported={() => {
            fetchTranscript();
          }}
        />
      </div>
    </div>
  );
};

export default TranscriptViewer;
