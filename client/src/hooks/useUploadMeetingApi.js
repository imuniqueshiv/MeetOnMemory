import { useState, useRef, useCallback } from "react";
import { meetingApi } from "../services";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

const useUploadMeetingApi = () => {
  const [state, setState] = useState({
    status: "idle", // 'idle' | 'pending' | 'paused' | 'success' | 'error'
    data: null,
    error: null,
    progress: 0,
    uploadId: null,
    currentChunkIndex: 0,
    totalChunks: 0,
    uploadedChunks: [],
    sessionMetadata: null,
  });

  const isPausedRef = useRef(false);

  const pauseUpload = useCallback(() => {
    isPausedRef.current = true;
    setState((prev) => ({ ...prev, status: "paused" }));
  }, []);

  const uploadMeetingResumable = useCallback(
    async (file, title, tags = [], date = "", options = {}) => {
      const { onSuccess, onError, existingUploadId } = options;

      if (!file && !existingUploadId) {
        const error = new Error("Please select an audio file first.");
        setState({ status: "error", data: null, error, progress: 0 });
        if (onError) onError(error);
        return;
      }

      isPausedRef.current = false;

      try {
        let uploadId = existingUploadId;
        let totalChunks = 0;
        let uploadedChunks = [];

        // 1. Initialize or Rehydrate Upload Session
        if (!uploadId) {
          const fileSize = file.size;
          totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

          const initRes = await meetingApi.initResumableUpload({
            fileName: file.name,
            fileSize,
            totalChunks,
            title,
            tags,
            date,
            mimeType: file.type,
          });

          if (!initRes.data?.success) {
            throw new Error(
              initRes.data?.message || "Failed to initialize resumable upload",
            );
          }

          uploadId = initRes.data.data.uploadId;
          try {
            localStorage.setItem(
              "active_upload_session",
              JSON.stringify({
                uploadId,
                fileName: file.name,
                fileSize,
                totalChunks,
                title,
                tags,
                date,
              }),
            );
          } catch {
            // ignore localStorage quota errors
          }
        } else {
          // Rehydrate existing upload session
          const statusRes = await meetingApi.getUploadStatus(uploadId);
          if (statusRes.data?.data) {
            totalChunks = statusRes.data.data.totalChunks;
            uploadedChunks = statusRes.data.data.uploadedChunks || [];
          }
        }

        setState({
          status: "pending",
          data: null,
          error: null,
          progress: Math.round(
            (uploadedChunks.length / Math.max(1, totalChunks)) * 100,
          ),
          uploadId,
          totalChunks,
          uploadedChunks,
          sessionMetadata: { title, tags, date },
        });

        // 2. Upload Chunks
        const fileSize = file ? file.size : 0;
        totalChunks = totalChunks || Math.ceil(fileSize / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
          if (isPausedRef.current) {
            setState((prev) => ({ ...prev, status: "paused" }));
            return;
          }

          if (uploadedChunks.includes(i)) {
            continue;
          }

          if (!file) {
            throw new Error(
              `Please re-select the file to resume chunk ${i + 1}`,
            );
          }

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileSize);
          const chunkBlob = file.slice(start, end);

          const formData = new FormData();
          formData.append("uploadId", uploadId);
          formData.append("chunkIndex", i);
          formData.append("totalChunks", totalChunks);
          formData.append("chunk", chunkBlob, file.name);

          // Retry logic per chunk (up to 3 attempts)
          let attempts = 0;
          let chunkSuccess = false;
          let lastChunkErr = null;

          while (attempts < 3 && !chunkSuccess && !isPausedRef.current) {
            attempts++;
            try {
              const chunkRes = await meetingApi.uploadChunk(formData, {
                onUploadProgress: (progressEvent) => {
                  const chunkPercent =
                    (progressEvent.loaded / progressEvent.total) *
                    (1 / totalChunks);
                  const totalPercent = Math.round(
                    ((uploadedChunks.length + chunkPercent) / totalChunks) *
                      100,
                  );
                  setState((prev) => ({
                    ...prev,
                    progress: Math.min(99, totalPercent),
                  }));
                },
              });

              if (chunkRes.data?.success) {
                chunkSuccess = true;
                if (!uploadedChunks.includes(i)) {
                  uploadedChunks.push(i);
                }
                setState((prev) => ({
                  ...prev,
                  currentChunkIndex: i,
                  uploadedChunks: [...uploadedChunks],
                  progress: Math.round(
                    (uploadedChunks.length / totalChunks) * 100,
                  ),
                }));
              } else {
                lastChunkErr = new Error(
                  chunkRes.data?.message || `Chunk ${i} failed`,
                );
              }
            } catch (chunkErr) {
              lastChunkErr = chunkErr;
              await new Promise((r) => setTimeout(r, 1000 * attempts)); // exponential backoff
            }
          }

          if (!chunkSuccess && !isPausedRef.current) {
            throw (
              lastChunkErr ||
              new Error(`Failed uploading chunk ${i + 1} after 3 retries`)
            );
          }
        }

        // 3. Complete and Assemble
        setState((prev) => ({ ...prev, progress: 99 }));
        const completeRes = await meetingApi.completeResumableUpload({
          uploadId,
        });

        if (completeRes.data?.success) {
          localStorage.removeItem("active_upload_session");
          setState({
            status: "success",
            data: completeRes.data.data,
            error: null,
            progress: 100,
            uploadId: null,
            currentChunkIndex: totalChunks,
            totalChunks,
            uploadedChunks,
            sessionMetadata: null,
          });
          if (onSuccess) onSuccess(completeRes.data.data);
        } else {
          throw new Error(completeRes.data?.message || "Assembly failed");
        }
      } catch (err) {
        console.error("Resumable upload error:", err);
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          "Upload failed during chunk processing";
        const error = new Error(errorMsg);
        setState((prev) => ({ ...prev, status: "error", error }));
        if (onError) onError(error);
      }
    },
    [],
  );

  const checkInactivityOrRehydrate = useCallback(async () => {
    try {
      const saved = localStorage.getItem("active_upload_session");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (!parsed?.uploadId) return null;

      const res = await meetingApi.getUploadStatus(parsed.uploadId);
      if (res.data?.data && res.data.data.status === "in_progress") {
        return {
          ...parsed,
          ...res.data.data,
        };
      } else {
        localStorage.removeItem("active_upload_session");
        return null;
      }
    } catch (e) {
      console.warn("Failed rehydrating upload session:", e);
      return null;
    }
  }, []);

  const abortCurrentUpload = useCallback(async (uploadIdToAbort) => {
    try {
      if (uploadIdToAbort) {
        await meetingApi.abortResumableUpload({ uploadId: uploadIdToAbort });
      }
      localStorage.removeItem("active_upload_session");
      setState({
        status: "idle",
        data: null,
        error: null,
        progress: 0,
        uploadId: null,
        currentChunkIndex: 0,
        totalChunks: 0,
        uploadedChunks: [],
        sessionMetadata: null,
      });
    } catch (e) {
      console.error("Error aborting upload session:", e);
    }
  }, []);

  const uploadMeeting = useCallback(
    (file, title, tags = [], options = {}) => {
      return uploadMeetingResumable(file, title, tags, "", options);
    },
    [uploadMeetingResumable],
  );

  return {
    ...state,
    uploadMeeting,
    uploadMeetingResumable,
    pauseUpload,
    checkInactivityOrRehydrate,
    abortCurrentUpload,
  };
};

export default useUploadMeetingApi;
