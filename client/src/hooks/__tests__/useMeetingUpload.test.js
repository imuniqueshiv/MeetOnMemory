import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useMeetingUpload from "../useMeetingUpload";
import { toast } from "react-toastify";
import { meetingApi } from "../../services";

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock meetingApi
vi.mock("../../services", () => ({
  meetingApi: {
    uploadMeeting: vi.fn(),
  },
}));

describe("useMeetingUpload hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with correct default states", () => {
    const { result } = renderHook(() => useMeetingUpload());

    expect(result.current.file).toBeNull();
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.isDragging).toBe(false);
    expect(result.current.transcript).toBe("");
    expect(result.current.meetingId).toBeNull();
  });

  it("should format file sizes correctly", () => {
    const { result } = renderHook(() => useMeetingUpload());

    expect(result.current.formatFileSize(0)).toBe("0 Bytes");
    expect(result.current.formatFileSize(1024)).toBe("1 KB");
    expect(result.current.formatFileSize(1048576)).toBe("1 MB");
  });

  it("should validate and set supported audio files", () => {
    const { result } = renderHook(() => useMeetingUpload());

    const validFile = new File(["dummy content"], "test.mp3", {
      type: "audio/mp3",
    });
    act(() => {
      result.current.validateAndSetFile(validFile);
    });

    expect(result.current.file).toEqual(validFile);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("should reject unsupported file types", () => {
    const { result } = renderHook(() => useMeetingUpload());

    const invalidFile = new File(["dummy content"], "test.txt", {
      type: "text/plain",
    });
    act(() => {
      result.current.validateAndSetFile(invalidFile);
    });

    expect(result.current.file).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      "Unsupported file type. Please use WAV, MP3, or M4A files.",
    );
  });

  it("should handle successful upload and trigger onSuccess callback", async () => {
    const mockResponse = {
      data: {
        success: true,
        transcript: "Hello world",
        meetingId: "123",
        autoTitle: "Auto Title",
      },
    };
    meetingApi.uploadMeeting.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useMeetingUpload());
    const validFile = new File(["dummy content"], "test.mp3", {
      type: "audio/mp3",
    });

    act(() => {
      result.current.validateAndSetFile(validFile);
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const setTitle = vi.fn();

    let promise;
    act(() => {
      promise = result.current.handleUpload("Test Title", {
        onSuccess,
        onError,
        setTitle,
      });
    });

    // Verify loading state
    expect(result.current.isUploading).toBe(true);
    expect(result.current.uploadState.status).toBe("loading");

    await act(async () => {
      await promise;
    });

    // Verify success state
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadState.status).toBe("success");
    expect(result.current.transcript).toBe("Hello world");
    expect(result.current.meetingId).toBe("123");
    expect(setTitle).toHaveBeenCalledWith("Auto Title");
    expect(onSuccess).toHaveBeenCalledWith({
      transcript: "Hello world",
      meetingId: "123",
      autoTitle: "Auto Title",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("should handle failed upload and trigger onError callback with normalized error", async () => {
    const mockError = new Error("Network issues");
    mockError.response = {
      status: 500,
      data: { message: "Server crash" },
    };
    meetingApi.uploadMeeting.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useMeetingUpload());
    const validFile = new File(["dummy content"], "test.mp3", {
      type: "audio/mp3",
    });

    act(() => {
      result.current.validateAndSetFile(validFile);
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    let promise;
    act(() => {
      promise = result.current.handleUpload("Test Title", {
        onSuccess,
        onError,
      });
    });

    await act(async () => {
      await promise;
    });

    // Verify error state
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadState.status).toBe("error");
    expect(result.current.uploadState.error).toEqual({
      message: "Server crash",
      code: "SERVER_ERROR",
      status: 500,
    });
    expect(onError).toHaveBeenCalledWith({
      message: "Server crash",
      code: "SERVER_ERROR",
      status: 500,
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
