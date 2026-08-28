import { useState, useRef } from "react";
import { toast } from "react-toastify";
import useDragAndDrop from "./useDragAndDrop";
import useUploadMeetingApi from "./useUploadMeetingApi";

import { formatFileSize, isValidAudioFile } from "../utils/fileUtils";

const useMeetingUpload = () => {
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [meetingId, setMeetingId] = useState(null);

  const fileInputRef = useRef(null);

  const validateAndSetFile = (f) => {
    if (!f) return;
    if (!isValidAudioFile(f)) {
      toast.error("Unsupported file type. Please use WAV, MP3, or M4A files.");
      return;
    }
    setFile(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) validateAndSetFile(f);
  };

  const handleDropCallback = (e) => {
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  };

  const { isDragging, handlers } = useDragAndDrop(handleDropCallback);

  const {
    status,
    progress,

    uploadId,
    totalChunks,
    uploadedChunks,
    uploadMeetingResumable,
    pauseUpload,

    checkInactivityOrRehydrate,
    abortCurrentUpload,
  } = useUploadMeetingApi();

  const isUploading = status === "pending";
  const isPaused = status === "paused";
  const isError = status === "error";
  const uploadProgress = progress;

  const resetUpload = (setSummary, setTitle) => {
    if (uploadId) {
      abortCurrentUpload(uploadId);
    }
    setFile(null);
    setTranscript("");
    if (setSummary) setSummary("");
    setMeetingId(null);
    if (setTitle) setTitle("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = (
    title,
    setTitle,
    tags = [],
    date = "",
    options = {},
  ) => {
    if (!file && !options.existingUploadId) {
      toast.error("Please select an audio file first.");
      return;
    }
    setTranscript("");
    setMeetingId(null);
    uploadMeetingResumable(file, title, tags, date, {
      existingUploadId: options.existingUploadId,
      onSuccess: (data) => {
        toast.success("Transcription complete!");
        setTranscript(data.transcript || "");
        setMeetingId(data.meetingId || null);
        if (data.autoTitle && setTitle) setTitle(data.autoTitle);
      },
      onError: (error) => {
        toast.error(error.message || "Upload failed");
      },
    });
  };

  return {
    file,
    setFile,
    uploadProgress,
    isUploading,
    isPaused,
    isError,
    status,
    uploadId,
    totalChunks,
    uploadedChunks,
    isDragging,
    transcript,
    setTranscript,
    meetingId,
    setMeetingId,
    fileInputRef,
    validateAndSetFile,
    handleFileChange,
    handleDragOver: handlers.onDragOver,
    handleDragLeave: handlers.onDragLeave,
    handleDrop: handlers.onDrop,
    resetUpload,
    handleUpload,
    pauseUpload,
    checkInactivityOrRehydrate,
    abortCurrentUpload,
    formatFileSize,
  };
};

export default useMeetingUpload;
