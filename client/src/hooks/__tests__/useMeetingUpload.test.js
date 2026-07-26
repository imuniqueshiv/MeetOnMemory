import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import useMeetingUpload from "../useMeetingUpload";
import { toast } from "react-toastify";

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useMeetingUpload hook", () => {
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
});
