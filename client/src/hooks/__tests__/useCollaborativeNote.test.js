// @vitest-environment jsdom
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCollaborativeNote } from "../useCollaborativeNote.js";
import { io } from "socket.io-client";
import { toast } from "react-toastify";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    userId: "user-123",
    getToken: vi.fn().mockResolvedValue("test-clerk-token"),
    isSignedIn: true,
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("socket.io-client", () => {
  const listeners = {};
  const mockSocket = {
    on(event, callback) {
      listeners[event] = callback;
    },
    emit(event, _data, cb) {
      if (event === "join-meeting" && typeof cb === "function") {
        cb({ success: true, userColor: "#ff0000", activeUsers: [] });
      }
    },
    disconnect: vi.fn(),
    __trigger(event, payload) {
      listeners[event]?.(payload);
    },
    __has(event) {
      return typeof listeners[event] === "function";
    },
  };
  return {
    io: vi.fn(() => mockSocket),
  };
});

describe("useCollaborativeNote socket URL & sync status (#2002, #2250)", () => {
  beforeEach(() => {
    io.mockClear();
    toast.error.mockClear();
  });

  it("connects to ${getBackendUrl()}/notes using shared Clerk socket options", async () => {
    renderHook(() => useCollaborativeNote("meeting-123"));

    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(
        expect.stringMatching(/^http:\/\/.*\/notes$/),
        expect.objectContaining({
          transports: expect.arrayContaining(["websocket"]),
        }),
      );
    });
  });

  it("handles connect_error, updates error + syncStatus, and triggers toast (#2250)", async () => {
    const { result } = renderHook(() => useCollaborativeNote("meeting-123"));

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });
    const mockSocket = io.mock.results.at(-1).value;

    await waitFor(() => {
      expect(mockSocket.__has("connect_error")).toBe(true);
    });

    act(() => {
      mockSocket.__trigger("connect_error", new Error("Authentication failed"));
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Authentication failed");
      expect(result.current.isConnected).toBe(false);
      expect(result.current.syncStatus).toBe("error");
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Authentication failed"),
      );
    });
  });

  it("sets offline syncStatus on disconnect (#2250)", async () => {
    const { result } = renderHook(() => useCollaborativeNote("meeting-123"));

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });
    const mockSocket = io.mock.results.at(-1).value;

    await waitFor(() => {
      expect(mockSocket.__has("disconnect")).toBe(true);
    });

    act(() => {
      mockSocket.__trigger("disconnect");
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
      expect(result.current.syncStatus).toBe("offline");
    });
  });
});
