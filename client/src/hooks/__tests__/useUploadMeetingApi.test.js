import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useUploadMeetingApi from "../useUploadMeetingApi";
import { meetingApi } from "../../services";

vi.mock("../../services", () => ({
  meetingApi: {
    uploadMeeting: vi.fn(),
  },
}));

describe("useUploadMeetingApi hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useUploadMeetingApi());

    expect(result.current.progress).toBe(0);
    expect(result.current.status).toBe("idle");
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should show error if no file is provided", async () => {
    const { result } = renderHook(() => useUploadMeetingApi());
    const onError = vi.fn();

    await act(async () => {
      await result.current.uploadMeeting(null, "Test Title", { onError });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe(
      "Please select an audio file first.",
    );
    expect(onError).toHaveBeenCalled();
  });

  it("should successfully upload a file and call onSuccess", async () => {
    const mockResponse = { data: { success: true, transcript: "Hello" } };
    meetingApi.uploadMeeting.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useUploadMeetingApi());
    const file = new File(["dummy content"], "test.mp3", { type: "audio/mp3" });
    const onSuccess = vi.fn();

    await act(async () => {
      await result.current.uploadMeeting(file, "Title", { onSuccess });
    });

    expect(meetingApi.uploadMeeting).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(mockResponse.data);
    expect(result.current.status).toBe("success");
    expect(result.current.progress).toBe(100);
  });

  it("should handle upload failure", async () => {
    const mockResponse = { data: { success: false, message: "Upload failed" } };
    meetingApi.uploadMeeting.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useUploadMeetingApi());
    const file = new File(["dummy content"], "test.mp3", { type: "audio/mp3" });
    const onError = vi.fn();

    await act(async () => {
      await result.current.uploadMeeting(file, "Title", { onError });
    });

    expect(onError).toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("Upload failed");
  });
});
