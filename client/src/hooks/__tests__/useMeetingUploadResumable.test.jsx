import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useMeetingUpload from "../useMeetingUpload";
import { meetingApi } from "../../services";

vi.mock("../../services", () => ({
  meetingApi: {
    initResumableUpload: vi.fn(),
    uploadChunk: vi.fn(),
    getUploadStatus: vi.fn(),
    completeResumableUpload: vi.fn(),
    abortResumableUpload: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useMeetingUpload Resumable Upload Hook (#2268)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("slice file into chunks and executes complete upload", async () => {
    meetingApi.initResumableUpload.mockResolvedValue({
      data: {
        success: true,
        data: { uploadId: "upload-999", chunkSize: 5242880, totalChunks: 1 },
      },
    });

    meetingApi.uploadChunk.mockResolvedValue({
      data: {
        success: true,
        data: { uploadId: "upload-999", chunkIndex: 0, uploadedChunks: [0] },
      },
    });

    meetingApi.completeResumableUpload.mockResolvedValue({
      data: {
        success: true,
        data: { meetingId: "m-123", transcript: "Chunked transcript text" },
      },
    });

    const { result } = renderHook(() => useMeetingUpload());

    const fakeFile = new File(["dummy audio content"], "test.mp3", {
      type: "audio/mpeg",
    });

    act(() => {
      result.current.setFile(fakeFile);
    });

    await act(async () => {
      result.current.handleUpload("Test Meeting", vi.fn(), ["tag1"]);
    });

    await waitFor(() => {
      expect(result.current.meetingId).toBe("m-123");
    });

    expect(meetingApi.initResumableUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "test.mp3",
      }),
    );
    expect(meetingApi.uploadChunk).toHaveBeenCalled();
    expect(meetingApi.completeResumableUpload).toHaveBeenCalledWith({
      uploadId: "upload-999",
    });
  });

  it("rehydrates in-progress upload session from localStorage", async () => {
    localStorage.setItem(
      "active_upload_session",
      JSON.stringify({
        uploadId: "active-session-1",
        fileName: "saved.mp3",
        fileSize: 1000,
        totalChunks: 2,
      }),
    );

    meetingApi.getUploadStatus.mockResolvedValue({
      data: {
        success: true,
        data: {
          uploadId: "active-session-1",
          fileName: "saved.mp3",
          fileSize: 1000,
          totalChunks: 2,
          uploadedChunks: [0],
          status: "in_progress",
        },
      },
    });

    const { result } = renderHook(() => useMeetingUpload());

    let session;
    await act(async () => {
      session = await result.current.checkInactivityOrRehydrate();
    });

    expect(session).toEqual(
      expect.objectContaining({
        uploadId: "active-session-1",
        uploadedChunks: [0],
      }),
    );
  });
});
