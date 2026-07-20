import { useState, useRef } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../services";

const allowedTypes = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/x-m4a",
  "audio/mp4",
  "audio/m4a",
];

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const normalizeError = (err) => {
  if (err.response) {
    return {
      message: err.response.data?.message || "Server error during upload",
      code: "SERVER_ERROR",
      status: err.response.status,
    };
  }
  if (err.request) {
    return {
      message: "No response from server. Check your network connection.",
      code: "NETWORK_ERROR",
      status: 0,
    };
  }
  return {
    message: err.message || "An unexpected error occurred",
    code: "CLIENT_ERROR",
    status: 500,
  };
};

const useMeetingUpload = () => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState({
    status: "idle", // "idle" | "loading" | "success" | "error"
    progress: 0,
    data: null,
    error: null,
  });

  // Expose refs if needed by UI
  const fileInputRef = useRef(null);

  const validateAndSetFile = (f) => {
    if (!f) return;
    const fileExt = f.name.split(".").pop().toLowerCase();
    const allowedExtensions = ["wav", "mp3", "m4a", "mp4"];

    if (
      !allowedTypes.includes(f.type) &&
      !allowedExtensions.includes(fileExt)
    ) {
      toast.error("Unsupported file type. Please use WAV, MP3, or M4A files.");
      return;
    }
    setFile(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) validateAndSetFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  };

  const resetUpload = (setSummary, setTitle) => {
    setFile(null);
    setUploadState({
      status: "idle",
      progress: 0,
      data: null,
      error: null,
    });
    if (setSummary) setSummary("");
    if (setTitle) setTitle("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async (title, options = {}) => {
    const callbacks =
      typeof options === "function" ? { setTitle: options } : options;
    const { onSuccess, onError, setTitle } = callbacks;

    if (!file) {
      toast.error("Please select an audio file first.");
      return;
    }

    try {
      setUploadState({
        status: "loading",
        progress: 0,
        data: null,
        error: null,
      });

      const formData = new FormData();
      formData.append("file", file);
      if (title) formData.append("title", title);

      const res = await meetingApi.uploadMeeting(formData, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          setUploadState((prev) => ({ ...prev, progress: percent }));
        },
      });

      if (res.data?.success) {
        const responseData = {
          transcript: res.data.transcript || "",
          meetingId: res.data.meetingId || null,
          autoTitle: res.data.autoTitle || "",
        };

        setUploadState({
          status: "success",
          progress: 0,
          data: responseData,
          error: null,
        });

        if (responseData.autoTitle && setTitle)
          setTitle(responseData.autoTitle);
        onSuccess?.(responseData);
      } else {
        const appErr = {
          message: res.data?.message || "Upload failed",
          code: "APP_ERROR",
          status: res.status || 200,
        };

        setUploadState({
          status: "error",
          progress: 0,
          data: null,
          error: appErr,
        });

        onError?.(appErr);
      }
    } catch (err) {
      console.error("Upload error:", err);
      const normalizedErr = normalizeError(err);

      setUploadState({
        status: "error",
        progress: 0,
        data: null,
        error: normalizedErr,
      });

      onError?.(normalizedErr);
    }
  };

  return {
    file,
    setFile,
    uploadProgress: uploadState.progress,
    isUploading: uploadState.status === "loading",
    isDragging,
    transcript: uploadState.data?.transcript || "",
    setTranscript: (val) =>
      setUploadState((prev) => ({
        ...prev,
        data: { ...(prev.data || {}), transcript: val },
      })),
    meetingId: uploadState.data?.meetingId || null,
    setMeetingId: (val) =>
      setUploadState((prev) => ({
        ...prev,
        data: { ...(prev.data || {}), meetingId: val },
      })),
    uploadState,
    fileInputRef,
    validateAndSetFile,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    resetUpload,
    handleUpload,
    formatFileSize,
  };
};

export default useMeetingUpload;
