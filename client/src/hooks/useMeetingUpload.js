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
  const { status, progress, uploadMeeting } = useUploadMeetingApi();
  const isUploading = status === "pending";
  const uploadProgress = progress;

  const resetUpload = (setSummary, setTitle) => {
    setFile(null);
    setTranscript("");
    if (setSummary) setSummary("");
    setMeetingId(null);
    if (setTitle) setTitle("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = (title, setTitle) => {
    if (!file) {
      toast.error("Please select an audio file first.");
      return;
    }
    setTranscript("");
    setMeetingId(null);
    uploadMeeting(file, title, {
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
    formatFileSize,
  };
};

export default useMeetingUpload;
