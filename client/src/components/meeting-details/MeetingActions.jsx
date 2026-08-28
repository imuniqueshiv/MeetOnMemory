import React, { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import AppContent from "../../context/AppContent.js";
import useExport from "../../hooks/useExport.js";
import { Mic, MicOff, Loader2, Mail, Send, Eye, X, Share2 } from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../services/apiClient";
import { meetingApi } from "../../services/meetingApi.js";
import { notionIntegrationApi } from "../../services/notionIntegrationApi.js";
import ConfirmModal from "../ConfirmModal.jsx";
import { usePolling } from "../../hooks/usePolling.js";
import {
  generateICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
} from "../../utils/calendarExport.js";

/**
 * Deadline for the post-recording transcription poll (Issue #1455).
 *
 * The previous poll had none — it ran until the transcript reached a terminal
 * status, which for a job that dies in the queue is never.
 */
const TRANSCRIPTION_POLL_TIMEOUT_MS = 10 * 60 * 1000;

const MeetingActions = ({ meeting, onDelete, onRename }) => {
  const navigate = useNavigate();
  const { userData } = useContext(AppContent) || {};
  const isViewerOrGuest =
    userData?.role === "viewer" || userData?.role === "guest";
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const { exportMeeting, isExporting } = useExport();

  // Email MoM modal state (#2254)
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);

  // Notion Sync state
  const [syncingNotion, setSyncingNotion] = useState(false);

  const handleNotionSync = async () => {
    if (!meeting?._id) return;
    try {
      setSyncingNotion(true);
      const res = await notionIntegrationApi.syncMeeting(meeting._id, true);
      const data = res.data?.data || res.data;
      if (data?.alreadySynced) {
        toast.info("Meeting was already synced to Notion.");
      } else {
        toast.success("Successfully synced meeting to Notion!");
      }
      if (data?.notionPageUrl) {
        window.open(data.notionPageUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Notion sync failed:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to sync meeting to Notion";
      toast.error(msg);
    } finally {
      setSyncingNotion(false);
    }
  };

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Owns the transcription poll below, including its teardown on unmount.
  const { startPolling } = usePolling();

  const handleDownloadTranscript = () => {
    if (!meeting.transcript) {
      toast.error("No transcript available to download.");
      return;
    }

    const blob = new Blob([meeting.transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meeting.title || "meeting"}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    exportMeeting(meeting, format);
  };

  const handleRename = () => {
    setNewTitle(meeting.title || "");
    setShowRenameModal(true);
  };

  const confirmRename = () => {
    if (newTitle.trim()) {
      onRename(meeting._id, newTitle.trim());
      setShowRenameModal(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleOpenEmailModal = () => {
    setShowEmailModal(true);
    setShowEmailPreview(false);
    setEmailPreviewHtml("");
  };

  const handleToggleEmailPreview = async () => {
    if (showEmailPreview) {
      setShowEmailPreview(false);
      return;
    }
    setShowEmailPreview(true);
    if (!emailPreviewHtml) {
      setEmailPreviewLoading(true);
      try {
        const response = await meetingApi.previewMeetingDigest(meeting._id);
        setEmailPreviewHtml(response.data);
      } catch (err) {
        console.error("Failed to load email preview:", err);
        toast.error("Failed to load email digest preview");
      } finally {
        setEmailPreviewLoading(false);
      }
    }
  };

  const handleSendEmailMoM = async () => {
    setSendingEmail(true);
    try {
      const { data } = await meetingApi.sendMeetingDigest(meeting._id);
      const count = data?.data?.recipientsSentTo ?? data?.recipientsSentTo ?? 0;
      toast.success(
        count > 0
          ? `Meeting MoM successfully sent to ${count} participant${count !== 1 ? "s" : ""}!`
          : "Meeting MoM email distribution completed!",
      );
      setShowEmailModal(false);
    } catch (err) {
      console.error("Failed to send meeting MoM email:", err);
      toast.error(
        err.response?.data?.message || "Failed to send meeting MoM email",
      );
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showDeleteModal) setShowDeleteModal(false);
        if (showRenameModal) setShowRenameModal(false);
        if (showEmailModal) setShowEmailModal(false);
      }
    };

    if (showDeleteModal || showRenameModal || showEmailModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteModal, showRenameModal, showEmailModal]);

  const handleBackdropClick = (e, closeModal) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const confirmDelete = () => {
    onDelete(meeting._id);
    setShowDeleteModal(false);
  };

  const handleBack = () => {
    if (
      window.history.state &&
      typeof window.history.state.idx === "number" &&
      window.history.state.idx > 0
    ) {
      navigate(-1);
    } else {
      navigate("/meetings");
    }
  };

  // Recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data } = await apiClient.post(
        `/api/meetings/${meeting._id}/recording/start`,
        {},
        { withCredentials: true },
      );

      if (!data.success) {
        throw new Error(data.message || "Failed to start recording");
      }

      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.success("Recording started");

      recordingIntervalRef.current = setInterval(async () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("audio", blob, "audio.webm");

          try {
            await apiClient.post(
              `/api/meetings/${meeting._id}/transcript/upload`,
              formData,
              {
                withCredentials: true,
              },
            );
            chunksRef.current = [];
          } catch (error) {
            console.error("Error uploading audio chunk:", error);
          }
        }
      }, 10000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error(error.message || "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream
      .getTracks()
      .forEach((track) => track.stop());

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    if (chunksRef.current.length > 0) {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "audio.webm");

      try {
        await apiClient.post(
          `/api/meetings/${meeting._id}/transcript/upload`,
          formData,
          {
            withCredentials: true,
          },
        );
      } catch (error) {
        console.error("Error uploading final audio chunk:", error);
      }
    }

    try {
      const { data } = await apiClient.post(
        `/api/meetings/${meeting._id}/recording/stop`,
        {},
        { withCredentials: true },
      );

      if (!data.success) {
        throw new Error(data.message || "Failed to stop recording");
      }

      setIsRecording(false);
      setIsProcessing(true);
      toast.success("Recording stopped, transcription started");

      startPolling(
        async ({ signal }) => {
          const { data: transcriptData } = await apiClient.get(
            `/api/meetings/${meeting._id}/transcript`,
            { withCredentials: true, signal },
          );

          if (!transcriptData.success) return false;

          if (transcriptData.transcript.status === "completed") {
            setIsProcessing(false);
            toast.success("Transcription completed!");
            window.location.reload();
            return true;
          }

          if (transcriptData.transcript.status === "failed") {
            setIsProcessing(false);
            toast.error("Transcription failed. Please try again.");
            return true;
          }

          return false;
        },
        {
          intervalMs: 5000,
          timeoutMs: TRANSCRIPTION_POLL_TIMEOUT_MS,
          onTimeout: () => {
            setIsProcessing(false);
            toast.info(
              "Transcription is taking longer than expected. Refresh the page to check on it.",
            );
          },
          onError: (error) =>
            console.error("Error polling transcript status:", error),
        },
      );
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast.error(error.message || "Failed to stop recording");
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, [isRecording]);

  if (!meeting) return null;

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
          Quick Actions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {!isViewerOrGuest ? (
            <button
              onClick={toggleRecording}
              disabled={isProcessing}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : isProcessing
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : isRecording ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Start Recording
                </>
              )}
            </button>
          ) : (
            <div
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed border border-gray-200 dark:border-gray-700 select-none"
              title="Recording is restricted to members and hosts"
            >
              <Mic className="w-4 h-4 opacity-50" />
              Recording (Read-Only)
            </div>
          )}

          <button
            onClick={handleDownloadTranscript}
            disabled={!meeting.transcript}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download Transcript
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
              Export MoM
            </button>
            {showExportMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => handleExport("pdf")}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Export as PDF
                </button>
                <button
                  onClick={() => handleExport("txt")}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Export as Text
                </button>
                <button
                  onClick={() => handleExport("docx")}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Export as DOCX
                </button>
                <button
                  onClick={() => handleExport("json")}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Export as JSON
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowCalendarMenu(!showCalendarMenu)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors text-sm font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Add to Calendar
            </button>
            {showCalendarMenu && (
              <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => {
                    setShowCalendarMenu(false);
                    generateICS(meeting);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Download ICS
                </button>
                <a
                  href={getGoogleCalendarUrl(meeting)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowCalendarMenu(false)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Google Calendar
                </a>
                <a
                  href={getOutlookCalendarUrl(meeting)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowCalendarMenu(false)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Outlook Web
                </a>
              </div>
            )}
          </div>

          <button
            onClick={handleOpenEmailModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg transition-colors text-sm font-medium cursor-pointer"
            title="Email MoM / summary to meeting participants"
            aria-label="Email MoM to participants"
          >
            <Mail className="w-4 h-4" />
            Email MoM
          </button>

          <button
            onClick={handleNotionSync}
            disabled={syncingNotion}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
            title="Sync meeting details and action items to Notion database"
            aria-label="Sync meeting to Notion"
          >
            {syncingNotion ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {syncingNotion ? "Syncing..." : "Sync to Notion"}
          </button>

          {!isViewerOrGuest && (
            <>
              <button
                onClick={handleRename}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Rename Meeting
              </button>

              <button
                onClick={handleDelete}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors text-sm font-medium"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Meeting
              </button>
            </>
          )}
        </div>

        <button
          onClick={handleBack}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Meeting Repository
        </button>
      </div>

      {/* Email MoM Modal (#2254) */}
      {showEmailModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Email MoM to Participants Modal"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEmailModal(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Email MoM to Participants
              </h3>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close email modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 mb-1">
                  Meeting
                </label>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">
                  {meeting.title}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 mb-1">
                  Recipients ({meeting.participants?.length || 0})
                </label>
                <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl max-h-32 overflow-y-auto space-y-1">
                  {meeting.participants && meeting.participants.length > 0 ? (
                    meeting.participants.map((p, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-gray-700 dark:text-slate-300 flex items-center justify-between"
                      >
                        <span className="font-medium truncate">
                          {p.name || p.email}
                        </span>
                        <span className="text-gray-400 dark:text-slate-500 text-[11px]">
                          {p.email}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      No participants registered for this meeting.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleToggleEmailPreview}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showEmailPreview
                    ? "Hide Email Preview"
                    : "Preview Digest Email HTML"}
                </button>

                {showEmailPreview && (
                  <div className="mt-2 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-950 p-3">
                    {emailPreviewLoading ? (
                      <div className="py-6 flex items-center justify-center text-xs text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                        Loading preview...
                      </div>
                    ) : (
                      <div
                        className="text-xs max-h-48 overflow-y-auto prose dark:prose-invert"
                        dangerouslySetInnerHTML={{
                          __html:
                            emailPreviewHtml || "<p>No preview generated.</p>",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-send-email-mom-button"
                onClick={handleSendEmailMoM}
                disabled={sendingEmail}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Email MoM
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Meeting Notes"
        message="Are you sure you want to delete this meeting? All associated notes, transcripts, and summaries will be permanently deleted."
      />

      {/* Rename Modal */}
      {showRenameModal && (
        <div
          onClick={(e) =>
            handleBackdropClick(e, () => setShowRenameModal(false))
          }
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-modal-title"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <h3
              id="rename-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Rename Meeting
            </h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  confirmRename();
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter new title"
              autoFocus
            />
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmRename}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-xs font-semibold cursor-pointer shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MeetingActions;
