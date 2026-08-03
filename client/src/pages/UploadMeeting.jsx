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
  X,
  Mic,
} from "lucide-react";
import { io } from "socket.io-client";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import useExport from "../hooks/useExport.js";
import { meetingApi } from "../services";
import useMeetingUpload from "../hooks/useMeetingUpload";
import Dropzone from "../components/meetings/Dropzone.jsx";
import MeetingRecorder from "../components/meetings/MeetingRecorder.jsx";
import TagAutocomplete from "../components/meetings/TagAutocomplete.jsx";
import { createClerkSocketOptions } from "../services/apiClient.js";

const UploadMeeting = () => {
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();

  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  // Redirect members to dashboard with a message
  useEffect(() => {
    if (!isAdmin) {
      toast.error("Only admins can upload meetings");
      navigate("/dashboard");
    }
  }, [isAdmin, navigate]);

  const {
    file,
    setFile,
    uploadProgress,
    isUploading,
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
    formatFileSize,
  } = useMeetingUpload();

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { exportMeeting, isExporting } = useExport();

  // Real-time listener for MoM completion
  const { backendUrl } = useContext(AppContent);
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
          // If the completed meeting matches our current meeting, update UI
          setSummary(
            data.summary || data.momText || JSON.stringify(data.mom || data),
          );
          toast.success("Minutes of Meeting created!");
          setIsSummarizing(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [userData, backendUrl]);

  // New fields for required date + optional title
  const [meetingDate, setMeetingDate] = useState(() => {
    // default to today's date in yyyy-mm-dd for input[type=date]
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState([]);
  const [activeTab, setActiveTab] = useState("upload"); // 'upload' or 'record'

  // If a transcript chunk comes back from live recording, append it to `transcript` hook state
  // Wait, `useMeetingUpload` gives us `transcript` as a state variable but it doesn't expose a setter directly?
  // Let's assume we can at least show it. We might need `setTranscript` from `useMeetingUpload`.
  // Wait, `useMeetingUpload` manages `transcript`. Let's just create a local transcript accumulator for live recording.
  const [liveTranscript, setLiveTranscript] = useState("");

  const handleTranscriptUpdate = (text, fullText) => {
    setLiveTranscript(fullText);
  };

  const handleGenerateSummary = async () => {
    if (!transcript && !meetingId) {
      toast.error("No transcript available. Upload a meeting first.");
      return;
    }
    // meeting date is required
    if (!meetingDate) {
      toast.error("Please select a meeting date (required).");
      return;
    }

    try {
      setIsSummarizing(true);
      setSummary("");

      // Prefer to send meetingId (backend will lookup transcript in DB); also send date + optional title
      const payload = {
        meetingId: meetingId || undefined,
        transcript: meetingId ? undefined : transcript,
        date: meetingDate,
        title: title || undefined, // backend will auto-generate if missing
      };

      const res = await meetingApi.summarizeMeeting(payload);

      if (
        res.status === 202 ||
        (res.data?.success && res.data?.message?.includes("background"))
      ) {
        toast.info(
          "Minutes generation started in the background. Please wait...",
        );
        // Keep isSummarizing true until socket event completes it
      } else if (res.data?.success) {
        setSummary(
          res.data.momText ||
            res.data.summary ||
            JSON.stringify(res.data.mom || res.data),
        );
        toast.success("Minutes of Meeting created!");
        setIsSummarizing(false);
      } else {
        toast.error(res.data?.message || "Failed to generate summary");
        setIsSummarizing(false);
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
    }
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    // Use the temporary generated mom object or saved object
    const meetingToExport = {
      _id: meetingId,
      title: title,
      structuredMoM: summary,
    };
    exportMeeting(meetingToExport, format);
  };

  const handleDownloadTranscript = () => {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${userData?.name || "meeting"}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
              Upload meeting recordings (WAV, MP3, M4A) or record live. We'll
              transcribe it using AI, then generate structured Minutes of
              Meeting (MoM).
            </p>
          </div>

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
                onClick={() => setActiveTab("record")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "record"
                    ? "bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Record Live
              </button>
            </div>
          </div>

          {/* Main Upload/Record Card (Glassmorphic) */}
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
                    Optional Title
                  </label>
                  <div className="relative">
                    <input
                      id="meeting-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="AI will auto-generate if left blank"
                      className="block w-full text-sm text-gray-700 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="meeting-date"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5"
                  >
                    <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    Meeting Date{" "}
                    <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="meeting-date"
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="block w-full sm:w-56 text-sm text-gray-700 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                      required
                    />
                  </div>
                </div>

                <TagAutocomplete
                  selectedTags={tags}
                  setSelectedTags={setTags}
                />

                <div className="pt-2 text-xs text-gray-400 dark:text-gray-500 leading-relaxed flex items-start gap-1.5">
                  <AlertCircle className="w-4.5 h-4.5 text-blue-400 dark:text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    Meeting date is required for compiling summaries. Accepted
                    audio formats include <strong>WAV</strong>,{" "}
                    <strong>MP3</strong>, and <strong>M4A</strong>.
                  </span>
                </div>
              </div>

              {/* Right Column: Audio Drag & Drop Area or Recorder */}
              <div>
                {activeTab === "upload" ? (
                  <>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      <FileAudio className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      Choose Meeting Audio
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
                      Live Audio Recorder
                    </label>
                    <MeetingRecorder
                      meetingId={meetingId}
                      onTranscriptUpdate={handleTranscriptUpdate}
                      onMeetingCreated={setMeetingId}
                      title={title}
                      date={meetingDate}
                      tags={tags}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Footer Actions inside Card */}
            {activeTab === "upload" && (
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto justify-start order-2 sm:order-1">
                  <button
                    onClick={() => handleUpload(title, setTitle, tags)}
                    disabled={isUploading || !file}
                    className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                      isUploading || !file
                        ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none border border-gray-200 dark:border-gray-600"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/10 hover:shadow-blue-500/25 hover:-translate-y-0.5 active:translate-y-0"
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Uploading ({uploadProgress}%)</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload & Transcribe</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => resetUpload(setSummary, setTitle)}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset
                  </button>
                </div>

                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
                  {file ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready to
                      transcribe
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-xs font-medium">
                      No file selected
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="mt-6 w-full animate-pulse">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2 font-bold">
                  <span>Sending audio package to server...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grid of Results: Transcript & MoM */}
          <div className="grid md:grid-cols-2 gap-8 fade-in-up stagger-2">
            {/* Transcript Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl p-6 flex flex-col min-h-[440px] transition-all duration-300 hover:shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-700 pb-3">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  Meeting Transcript
                </h3>
                {(transcript || liveTranscript) && (
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Generated
                  </span>
                )}
              </div>

              <div className="flex-grow flex flex-col justify-between">
                {transcript || liveTranscript ? (
                  <>
                    <div className="text-gray-700 whitespace-pre-wrap max-h-[280px] overflow-y-auto border border-gray-100 p-4 rounded-xl bg-gray-50/50 text-sm leading-relaxed mb-4 scrollbar-thin">
                      {liveTranscript || transcript}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleDownloadTranscript}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(transcript);
                          toast.success("Transcript copied to clipboard.");
                        }}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button
                        onClick={() => handleGenerateSummary()}
                        disabled={
                          isSummarizing || (!transcript && !liveTranscript)
                        }
                        className={`ml-auto px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer ${
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
                            <span>Generate Minutes (MoM)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-2xl flex items-center justify-center mb-3 text-gray-400 dark:text-gray-500">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">
                      No Transcript Yet
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[240px] leading-relaxed">
                      Provide meeting details, upload a recorded meeting audio
                      file, and run transcription to begin.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Minutes Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl p-6 flex flex-col min-h-[440px] transition-all duration-300 hover:shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-700 pb-3">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400 animate-pulse" />
                  AI Minutes of Meeting (MoM)
                </h3>
                {summary && (
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Compiled
                  </span>
                )}
              </div>

              <div className="flex-grow flex flex-col justify-between">
                {isSummarizing ? (
                  <div className="flex-grow flex flex-col items-center justify-center py-10 text-center animate-pulse">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-2xl flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                        <Sparkles
                          className="w-8 h-8 animate-spin"
                          style={{ animationDuration: "3s" }}
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-gray-800 shadow">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-1.5">
                      Analyzing Meeting Details
                    </h4>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 max-w-[280px] leading-relaxed mb-4">
                      Gemini is parsing the transcript, organizing action
                      points, and structuring details. This may take up to a
                      minute...
                    </p>
                    {/* Visual Skeleton Bars */}
                    <div className="w-full max-w-[240px] space-y-2 mt-2">
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-full"></div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-5/6"></div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-4/5"></div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-2/3"></div>
                    </div>
                  </div>
                ) : summary ? (
                  <>
                    <div className="text-gray-700 whitespace-pre-wrap max-h-[280px] overflow-y-auto border border-gray-100 p-4 rounded-xl bg-gray-50/50 text-sm leading-relaxed mb-4 scrollbar-thin">
                      {summary}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(summary);
                          toast.success("Minutes copied to clipboard.");
                        }}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setShowExportMenu(!showExportMenu)}
                          disabled={isExporting}
                          className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isExporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {isExporting ? "Exporting..." : "Export MoM"}
                        </button>
                        {showExportMenu && (
                          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-20 overflow-hidden">
                            <button
                              onClick={() => handleExport("pdf")}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium border-b border-gray-50 dark:border-gray-700"
                            >
                              Export as PDF
                            </button>
                            <button
                              onClick={() => handleExport("docx")}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium border-b border-gray-50 dark:border-gray-700"
                            >
                              Export as DOCX
                            </button>
                            <button
                              onClick={() => handleExport("md")}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                            >
                              Export as Markdown
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() =>
                          toast.info(
                            "Meeting saved (already saved during summarization).",
                          )
                        }
                        className="ml-auto px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Saved
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-2xl flex items-center justify-center mb-3 text-gray-400 dark:text-gray-500">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">
                      AI Minutes Awaiting
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[240px] leading-relaxed">
                      Once your meeting is uploaded and transcribed, run the MoM
                      generator to automatically structure minutes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-center mt-10 text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 fade-in-up stagger-3">
            <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span>
              💡 For best results, ensure clear, noise-free recording quality.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadMeeting;
