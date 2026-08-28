import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  UploadCloud,
  Calendar,
  Type,
  FileAudio,
  FileText,
  Sparkles,
  Loader2,
  Trash2,
  Copy,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mic,
  Pause,
  Play,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { io } from "socket.io-client";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import useExport from "../hooks/useExport.js";
import { meetingApi } from "../services";
import useMeetingUpload from "../hooks/useMeetingUpload";
import Dropzone from "../components/meetings/Dropzone.jsx";
import MeetingRecorder from "../components/meetings/MeetingRecorder.jsx";
import DeviceSetupModal from "../components/meetings/DeviceSetupModal.jsx";
import useDevicePermission from "../hooks/useDevicePermission";
import TagAutocomplete from "../components/meetings/TagAutocomplete.jsx";
import RecordingSessionAnalyticsPanel from "../components/analytics/RecordingSessionAnalyticsPanel.jsx";
import AiMinutesCard from "../components/meetings/AiMinutesCard.jsx";
import { createClerkSocketOptions } from "../services/apiClient.js";

import { hasPermission } from "../utils/rbacPermissions.js";

const UploadMeeting = () => {
  const { userData, backendUrl } = useContext(AppContent);
  const navigate = useNavigate();

  const userRole = userData?.role || "member";
  const canCreateMeeting = hasPermission(userRole, "meetings", "create");

  const {
    file,
    setFile,
    uploadProgress,
    isUploading,
    isPaused,
    isError,
    uploadId,
    totalChunks,
    uploadedChunks,
    isDragging,
    transcript,
    meetingId,
    setMeetingId,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    resetUpload,
    handleUpload,
    pauseUpload,
    checkInactivityOrRehydrate,
    abortCurrentUpload,
    formatFileSize,
  } = useMeetingUpload();

  const [rehydratedSession, setRehydratedSession] = useState(null);

  useEffect(() => {
    (async () => {
      if (checkInactivityOrRehydrate) {
        const session = await checkInactivityOrRehydrate();
        if (session) {
          setRehydratedSession(session);
        }
      }
    })();
  }, [checkInactivityOrRehydrate]);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [processingStep, setProcessingStep] = useState(0); // 0: Idle, 1: Uploading, 2: Transcribing, 3: MoM Generation, 4: Complete
  const { exportMeeting, isExporting } = useExport();

  // Form Fields
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [showDeviceSetup, setShowDeviceSetup] = useState(false);
  const [deviceStream, setDeviceStream] = useState(null);
  const [autoStartRecording, setAutoStartRecording] = useState(false);
  const [bypassDeviceSetup, setBypassDeviceSetup] = useState(false);
  const permission = useDevicePermission();

  const stopDeviceStream = () => {
    deviceStream?.getTracks?.().forEach((track) => track.stop());
    setDeviceStream(null);
  };

  const openRecordTab = () => {
    setActiveTab("record");
    setBypassDeviceSetup(false);
    setShowDeviceSetup(true);
  };

  const handleDeviceReady = (stream) => {
    permission.releaseStream();
    setDeviceStream(stream);
    setShowDeviceSetup(false);
    setBypassDeviceSetup(false);
    setAutoStartRecording(true);
    setTimeout(() => setAutoStartRecording(false), 0);
  };

  const handleContinueWithoutDevices = () => {
    permission.releaseStream();
    stopDeviceStream();
    setBypassDeviceSetup(true);
    setShowDeviceSetup(false);
    setAutoStartRecording(true);
    setTimeout(() => setAutoStartRecording(false), 0);
  };

  useEffect(
    () => () => {
      deviceStream?.getTracks?.().forEach((track) => track.stop());
    },
    [deviceStream],
  );

  // Warn on browser unload if recording or uploading in progress
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isUploading || isSummarizing || isRecordingActive) {
        e.preventDefault();
        e.returnValue =
          "You have an active recording or upload in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading, isSummarizing, isRecordingActive]);

  // Real-time MoM WebSocket listener
  useEffect(() => {
    if (!userData || !backendUrl) return;

    let socket;
    let cancelled = false;

    (async () => {
      const opts = await createClerkSocketOptions();
      if (cancelled) return;
      socket = io(backendUrl, opts);
      socket.on("mom-generation-complete", (data) => {
        if (data && data.meetingId) {
          setSummary(
            data.summary || data.momText || JSON.stringify(data.mom || data),
          );
          toast.success("Minutes of Meeting created!");
          setIsSummarizing(false);
          setProcessingStep(4);
        }
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [userData, backendUrl]);

  const handleTranscriptUpdate = (text, fullText) => {
    setLiveTranscript(fullText);
    setIsRecordingActive(true);
  };

  const handleRecordingFinalized = async ({
    meetingId: recMeetingId,
    transcript: recTranscript,
  }) => {
    setIsRecordingActive(false);
    setProcessingStep(2);

    if (recMeetingId) {
      setMeetingId(recMeetingId);
    }

    if (recTranscript) {
      setLiveTranscript(recTranscript);
      await handleGenerateSummary(recMeetingId, recTranscript);
    }
  };

  const handleGenerateSummary = async (
    overrideMeetingId,
    overrideTranscript,
  ) => {
    const targetTranscript = overrideTranscript || liveTranscript || transcript;
    const targetMeetingId = overrideMeetingId || meetingId;

    if (!targetTranscript && !targetMeetingId) {
      toast.error("No transcript available to summarize.");
      return;
    }

    if (!meetingDate) {
      toast.error("Please select a meeting date (required).");
      return;
    }

    try {
      setIsSummarizing(true);
      setProcessingStep(3);
      setSummary("");

      const payload = {
        meetingId: targetMeetingId || undefined,
        transcript: targetMeetingId ? undefined : targetTranscript,
        date: meetingDate,
        title: title || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };

      const res = await meetingApi.summarizeMeeting(payload);

      if (
        res.status === 202 ||
        (res.data?.success && res.data?.message?.includes("background"))
      ) {
        toast.info("AI Minutes generation started in background...");
      } else if (res.data?.success) {
        setSummary(
          res.data.momText ||
            res.data.summary ||
            JSON.stringify(res.data.mom || res.data),
        );
        toast.success("Minutes of Meeting compiled!");
        setIsSummarizing(false);
        setProcessingStep(4);
      } else {
        toast.error(res.data?.message || "Failed to generate summary");
        setIsSummarizing(false);
        setProcessingStep(0);
      }
    } catch (err) {
      console.error("Summarize error:", err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          err.message ||
          "AI summarization failed",
      );
      setIsSummarizing(false);
      setProcessingStep(0);
    }
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    const meetingToExport = {
      _id: meetingId,
      title: title || "Meeting_Export",
      structuredMoM: summary,
    };
    exportMeeting(meetingToExport, format);
  };

  const handleDownloadTranscript = () => {
    const textToDownload = liveTranscript || transcript;
    if (!textToDownload) return;
    const blob = new Blob([textToDownload], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "meeting"}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (userData && !canCreateMeeting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-sans">
        <Navbar />
        <div className="flex-grow pt-28 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              You do not have permission to upload or record meetings. Please
              contact your organization administrator if you need access.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50/50 dark:from-gray-900 dark:via-slate-900 dark:to-blue-900/20 flex flex-col font-sans">
      <Navbar />
      <div className="flex-grow pt-28 pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-10 fade-in-up">
            <div className="inline-flex items-center justify-center p-3 bg-blue-50/80 dark:bg-blue-900/30 rounded-2xl mb-4 border border-blue-100 dark:border-blue-800 shadow-inner">
              <UploadCloud className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
              Upload or Record Meeting
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xl mx-auto text-sm sm:text-base">
              Upload meeting audio recordings (WAV, MP3, M4A) or record live.
              We&apos;ll transcribe speech using AI and compile structured
              Minutes of Meeting.
            </p>
          </div>

          {/* Multi-step Workflow Progress Indicator */}
          {(isUploading || isSummarizing || processingStep > 0) && (
            <div className="mb-8 p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md">
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Meeting Processing Workflow
                </span>
                <span>
                  {processingStep === 1 && "Step 1/4: Uploading Audio"}
                  {processingStep === 2 && "Step 2/4: Transcribing"}
                  {processingStep === 3 && "Step 3/4: Generating AI MoM"}
                  {processingStep === 4 && "Step 4/4: Complete!"}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500 shadow-md"
                  style={{
                    width: `${
                      processingStep === 1
                        ? Math.max(10, uploadProgress)
                        : processingStep === 2
                          ? 50
                          : processingStep === 3
                            ? 80
                            : processingStep === 4
                              ? 100
                              : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Rehydrated Session Banner */}
          {rehydratedSession && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div>
                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Unfinished Resumable Upload Session Found
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  File: <strong>{rehydratedSession.fileName}</strong> (
                  {rehydratedSession.uploadedChunks?.length || 0} of{" "}
                  {rehydratedSession.totalChunks} chunks stored on server)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setProcessingStep(1);
                    handleUpload(
                      rehydratedSession.metadata?.title || title,
                      setTitle,
                      rehydratedSession.metadata?.tags || tags,
                      rehydratedSession.metadata?.date || meetingDate,
                      { existingUploadId: rehydratedSession.uploadId },
                    );
                    setRehydratedSession(null);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" /> Resume Upload
                </button>
                <button
                  onClick={() => {
                    abortCurrentUpload(rehydratedSession.uploadId);
                    setRehydratedSession(null);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 rounded-lg transition-colors cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Toggle Tabs */}
          <div className="flex justify-center mb-8 fade-in-up stagger-1">
            <div className="inline-flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("upload")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "upload"
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Upload File
              </button>
              <button
                onClick={openRecordTab}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "record"
                    ? "bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Record Live
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "analytics"
                    ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Session Analytics
              </button>
            </div>
          </div>

          {showDeviceSetup && activeTab === "record" && (
            <div className="fixed inset-0 z-[100] overflow-y-auto">
              <DeviceSetupModal
                permission={permission}
                onJoin={handleDeviceReady}
                onContinueWithout={handleContinueWithoutDevices}
              />
            </div>
          )}

          {/* Active Tab Content */}
          {activeTab === "analytics" ? (
            <div className="mb-10 fade-in-up stagger-1">
              <RecordingSessionAnalyticsPanel />
            </div>
          ) : (
            /* Main Upload/Record Card */
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700 p-6 md:p-8 mb-10 transition-all duration-300 hover:shadow-2xl fade-in-up stagger-1">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column: Form Inputs */}
                <div className="flex flex-col justify-between space-y-5">
                  <div>
                    <label
                      htmlFor="meeting-title"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5"
                    >
                      <Type className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      Meeting Title (Optional)
                    </label>
                    <input
                      id="meeting-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Auto-generated by AI if left blank"
                      className="block w-full text-sm text-gray-700 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="meeting-date"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5"
                    >
                      <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      Meeting Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="meeting-date"
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="block w-full sm:w-56 text-sm text-gray-700 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                      required
                    />
                  </div>

                  <TagAutocomplete
                    selectedTags={tags}
                    setSelectedTags={setTags}
                  />

                  <div className="pt-2 text-xs text-gray-400 dark:text-gray-500 leading-relaxed flex items-start gap-1.5">
                    <AlertCircle className="w-4.5 h-4.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      Meeting date is required for organizing notes. Supported
                      audio formats: <strong>WAV</strong>, <strong>MP3</strong>,{" "}
                      <strong>M4A</strong>.
                    </span>
                  </div>
                </div>

                {/* Right Column: Audio Drag & Drop Area or Live Recorder */}
                <div>
                  {activeTab === "upload" ? (
                    <>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                        <FileAudio className="w-4 h-4 text-blue-500" />
                        Choose Meeting Audio File
                      </label>

                      <Dropzone
                        file={file}
                        setFile={setFile}
                        isDragging={isDragging}
                        handleDragOver={handleDragOver}
                        handleDragLeave={handleDragLeave}
                        handleDrop={handleDrop}
                        handleFileChange={handleFileChange}
                        fileInputRef={fileInputRef}
                        formatFileSize={formatFileSize}
                      />
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                        <Mic className="w-4 h-4 text-red-500" />
                        Live Microphone Recorder
                      </label>
                      <MeetingRecorder
                        meetingId={meetingId}
                        onTranscriptUpdate={handleTranscriptUpdate}
                        onMeetingCreated={setMeetingId}
                        onRecordingFinalized={handleRecordingFinalized}
                        title={title}
                        date={meetingDate}
                        tags={tags}
                        deviceStream={deviceStream}
                        autoStart={autoStartRecording}
                        onDeviceSetupNeeded={
                          bypassDeviceSetup
                            ? undefined
                            : () => {
                                setBypassDeviceSetup(false);
                                setShowDeviceSetup(true);
                              }
                        }
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Footer Actions inside Card */}
              {activeTab === "upload" && (
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-start order-2 sm:order-1">
                    {isUploading ? (
                      <button
                        onClick={() => pauseUpload()}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Pause className="w-4 h-4" />
                        <span>Pause Upload ({uploadProgress}%)</span>
                      </button>
                    ) : isPaused ? (
                      <button
                        onClick={() => {
                          setProcessingStep(1);
                          handleUpload(title, setTitle, tags, meetingDate, {
                            existingUploadId: uploadId,
                          });
                        }}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        <span>Resume Upload ({uploadProgress}%)</span>
                      </button>
                    ) : isError ? (
                      <button
                        onClick={() => {
                          setProcessingStep(1);
                          handleUpload(title, setTitle, tags, meetingDate, {
                            existingUploadId: uploadId,
                          });
                        }}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Retry Failed Chunk</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setProcessingStep(1);
                          handleUpload(title, setTitle, tags, meetingDate);
                        }}
                        disabled={!file}
                        className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                          !file
                            ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none border border-gray-200 dark:border-gray-600"
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/10 hover:shadow-blue-500/25 hover:-translate-y-0.5 active:translate-y-0"
                        }`}
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload & Transcribe (Resumable)</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setProcessingStep(0);
                        resetUpload(setSummary, setTitle);
                      }}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Reset
                    </button>
                  </div>

                  <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
                    {file ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ready for
                          resumable chunk upload
                        </span>
                        {totalChunks > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            ({uploadedChunks?.length || 0}/{totalChunks} chunks)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs font-medium">
                        No file selected
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid of Results: Transcript & AI MoM */}
          <div className="grid md:grid-cols-2 gap-8 fade-in-up stagger-2">
            {/* Transcript Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl p-6 flex flex-col min-h-[440px]">
              <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-700 pb-3">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Meeting Transcript
                </h3>
                {(transcript || liveTranscript) && (
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-2 py-0.5 rounded-full uppercase">
                    Available
                  </span>
                )}
              </div>

              <div className="flex-grow flex flex-col justify-between">
                {transcript || liveTranscript ? (
                  <>
                    <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap max-h-[280px] overflow-y-auto border border-gray-100 dark:border-gray-700 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 text-sm leading-relaxed mb-4 scrollbar-thin">
                      {liveTranscript || transcript}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleDownloadTranscript}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            liveTranscript || transcript,
                          );
                          toast.success("Transcript copied to clipboard.");
                        }}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button
                        onClick={() => handleGenerateSummary()}
                        disabled={
                          isSummarizing || (!transcript && !liveTranscript)
                        }
                        className={`ml-auto px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all flex items-center gap-1.5 ${
                          isSummarizing ? "opacity-70 cursor-not-allowed" : ""
                        }`}
                      >
                        {isSummarizing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Generate MoM</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-2xl flex items-center justify-center mb-3 text-gray-400">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">
                      No Transcript Yet
                    </h4>
                    <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed">
                      Upload an audio file or record live microphone input to
                      generate transcript.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Minutes Card */}
            <AiMinutesCard
              isSummarizing={isSummarizing}
              summary={summary}
              setSummary={setSummary}
              handleGenerateSummary={() => handleGenerateSummary()}
              onRegenerate={() => handleGenerateSummary()}
              showExportMenu={showExportMenu}
              setShowExportMenu={setShowExportMenu}
              isExporting={isExporting}
              handleExport={handleExport}
              canEdit={canCreateMeeting}
              canGenerate={canCreateMeeting}
              canExport={canCreateMeeting}
            />
          </div>

          <div className="text-center mt-10 text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>
              💡 Record or upload clear audio for accurate AI transcription and
              summary.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadMeeting;
