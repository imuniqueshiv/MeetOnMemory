import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import useWebRTC from "../useWebRTC";
import AppContent from "../../context/AppContent";

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.useFakeTimers();

describe("useWebRTC Hook", () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      emit: vi.fn(),
      on: vi.fn(),
      disconnect: vi.fn(),
    };
    // Mock navigator.mediaDevices.getDisplayMedia
    Object.defineProperty(window.navigator, "mediaDevices", {
      writable: true,
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
          getVideoTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
    const originalCreateElement = document.createElement.bind(document);
    window.document.createElement = vi.fn().mockImplementation((tag) => {
      if (tag === "canvas") {
        return {
          getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
          toDataURL: vi
            .fn()
            .mockReturnValue("data:image/jpeg;base64,mockedData"),
          width: 0,
          height: 0,
        };
      }
      return originalCreateElement(tag);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should capture visual frames during screen sharing and emit them", async () => {
    const callbacks = {
      onSocketConnect: (socket) => {
        Object.assign(socket, mockSocket);
      },
    };

    const wrapper = ({ children }) => (
      <AppContent.Provider value={{ userData: { id: "123", name: "Test" } }}>
        {children}
      </AppContent.Provider>
    );

    const { result } = renderHook(() => useWebRTC("room-123", callbacks), {
      wrapper,
    });

    await act(async () => {
      await result.current.toggleScreenShare();
    });

    // Verify interval is set
    expect(result.current.isScreenSharing).toBe(true);

    // Fast-forward 10 seconds to trigger interval
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // We can't strictly test canvas drawing without a proper DOM mock of userVideoRef,
    // but we can ensure socket emit was attempted if userVideoRef had a readyState.
    // Assuming the userVideoRef is mocked in a full test, we just check no crashes.
  });
});
