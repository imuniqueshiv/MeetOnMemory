import { useState, useCallback } from "react";
import { meetingApi } from "../services";

const useUploadMeetingApi = () => {
  const [state, setState] = useState({
    status: "idle", // 'idle' | 'pending' | 'success' | 'error'
    data: null,
    error: null,
    progress: 0,
  });

  const uploadMeeting = useCallback(async (file, title, options = {}) => {
    const { onSuccess, onError } = options;

    if (!file) {
      const error = new Error("Please select an audio file first.");
      setState({ status: "error", data: null, error, progress: 0 });
      if (onError) onError(error);
      return;
    }

    try {
      setState({ status: "pending", data: null, error: null, progress: 0 });

      const formData = new FormData();
      formData.append("file", file);
      if (title) formData.append("title", title);

      const res = await meetingApi.uploadMeeting(formData, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          setState((prev) => ({ ...prev, progress: percent }));
        },
      });

      if (res.data?.success) {
        setState({
          status: "success",
          data: res.data,
          error: null,
          progress: 100,
        });
        if (onSuccess) onSuccess(res.data);
      } else {
        const errorMsg = res.data?.message || "Upload failed";
        const error = new Error(errorMsg);
        setState({ status: "error", data: null, error, progress: 0 });
        if (onError) onError(error);
      }
    } catch (err) {
      console.error("Upload error:", err);
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Server error during upload";
      const error = new Error(errorMsg);
      setState({ status: "error", data: null, error, progress: 0 });
      if (onError) onError(error);
    }
  }, []);

  return { ...state, uploadMeeting };
};

export default useUploadMeetingApi;
