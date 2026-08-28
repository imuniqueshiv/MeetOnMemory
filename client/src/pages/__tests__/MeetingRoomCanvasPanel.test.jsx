/**
 * MeetingRoomCanvasPanel.test.jsx
 *
 * Tests that the CollaborativeCanvas whiteboard panel is correctly wired
 * into MeetingRoom with live socket, userId, and color props (Issue #2234).
 *
 * Covers:
 *  - Canvas panel mounts when the Canvas toggle is clicked
 *  - Canvas panel receives socket, userId, and userColor props
 *  - Switching panels unmounts the canvas (cleanup)
 *  - Canvas panel is hidden by default
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingRoom from "../MeetingRoom.jsx";
import AppContent from "../../context/AppContent.js";

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("react-router-dom", () => ({
  useParams: () => ({ roomId: "room-canvas-test" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isSignedIn: true,
    isLoaded: true,
    userId: "clerk_user_canvas",
  }),
}));

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    id: "socket_canvas_1",
    auth: {},
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("../../services/apiClient.js", () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }) },
  createClerkSocketOptions: vi.fn(async () => ({
    auth: { token: "t" },
    transports: ["websocket"],
  })),
  getClerkBearerToken: vi.fn(async () => "t"),
}));

vi.mock("../../hooks/useDevicePermission", () => ({
  default: () => ({
    selectedCamera: "cam-1",
    selectedMicrophone: "mic-1",
    releaseStream: vi.fn(),
  }),
}));

vi.mock("../../hooks/useWebRTC", () => ({
  default: () => ({
    socketRef: {
      current: { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() },
    },
    userVideoRef: { current: null },
    streamRef: { current: null },
  }),
}));

vi.mock("../../hooks/useLiveTranscription", () => ({
  default: () => ({ toggleTranscription: vi.fn() }),
}));

vi.mock("../../hooks/useReactions", () => ({
  default: () => ({
    reactions: [],
    sendReaction: vi.fn(),
    onCooldown: false,
  }),
}));

vi.mock("../../utils/mediaStream", () => ({
  resolveMeetingMediaStream: vi.fn().mockResolvedValue({
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
  }),
  getTrackEnabledState: vi
    .fn()
    .mockReturnValue({ micOn: true, cameraOn: true }),
}));

vi.mock("../../components/meetings/DeviceSetupModal.jsx", () => ({
  default: ({ onJoin }) => (
    <div data-testid="device-setup">
      <button type="button" onClick={() => onJoin(null)}>
        Mock Join Button
      </button>
    </div>
  ),
}));

vi.mock("../../components/meetings/CollaborativeEditor.jsx", () => ({
  default: () => <div data-testid="editor">Editor</div>,
}));

vi.mock("../../components/meetings/ParkingLotPanel.jsx", () => ({
  default: () => <div data-testid="parking-lot-content">Parking Lot</div>,
}));

vi.mock("../../components/meeting-details/PollSection.jsx", () => ({
  default: () => <div data-testid="poll-section">Polls</div>,
}));

vi.mock("../../components/meeting-details/AgendaTimer.jsx", () => ({
  // eslint-disable-next-line no-unused-vars
  default: ({ meeting, compact }) => (
    <div data-testid={compact ? "agenda-timer-banner" : "agenda-timer"}>
      Agenda
    </div>
  ),
}));

vi.mock("../../components/meetings/LiveCaptions.jsx", () => ({
  default: () => <div data-testid="captions">Captions</div>,
}));

vi.mock("../../components/meeting-room/LiveIcebreakerBanner.jsx", () => ({
  default: () => <div data-testid="icebreaker" />,
}));

vi.mock("../../components/meeting-room/MultiLanguageTranscript.jsx", () => ({
  default: () => null,
}));

vi.mock("../../components/meetings/TranscriptPanel.jsx", () => ({
  default: ({ showTranscript }) =>
    showTranscript ? (
      <div data-testid="meeting-room-transcript-panel">Transcript</div>
    ) : null,
}));

vi.mock("../../components/meetings/ReactionBar.jsx", () => ({
  default: () => null,
}));

vi.mock("../../components/meetings/ReactionOverlay.jsx", () => ({
  default: () => null,
}));

vi.mock("../../components/meetings/MeetingControlBar.jsx", () => ({
  default: () => <div data-testid="control-bar">Controls</div>,
}));

vi.mock("../../components/meetings/PeerVideo.jsx", () => ({
  default: () => <div data-testid="peer-video" />,
}));

vi.mock("../../components/meeting-room/BreakoutRoomPanel.jsx", () => ({
  default: () => <div data-testid="breakout-room-panel" />,
}));

// The component under test — mock it to capture props
const mockCanvasTestId = "collaborative-canvas-mock";
vi.mock("../../components/meeting-room/CollaborativeCanvas.jsx", () => ({
  default: ({ socket, userId, userColor }) => (
    <div
      data-testid={mockCanvasTestId}
      data-socket={socket ? "connected" : "null"}
      data-user-id={userId}
      data-user-color={userColor}
    >
      Collaborative Canvas
    </div>
  ),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const wrapper = ({ children }) => (
  <AppContent.Provider
    value={{
      userData: { _id: "mongo_user_canvas", name: "CanvasUser" },
    }}
  >
    {children}
  </AppContent.Provider>
);

const joinMeeting = async () => {
  fireEvent.click(screen.getByRole("button", { name: /mock join button/i }));
  await waitFor(() => {
    expect(
      screen.getByRole("banner", { name: /meeting room header/i }),
    ).toBeInTheDocument();
  });
};

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe("MeetingRoom — CollaborativeCanvas panel (Issue #2234)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does NOT render canvas panel by default after joining", async () => {
    render(<MeetingRoom />, { wrapper });
    await joinMeeting();

    expect(
      screen.queryByTestId("meeting-room-canvas-panel"),
    ).not.toBeInTheDocument();
  });

  it("opens canvas panel when Canvas toggle is clicked", async () => {
    render(<MeetingRoom />, { wrapper });
    await joinMeeting();

    fireEvent.click(screen.getByRole("button", { name: /canvas/i }));

    expect(screen.getByTestId("meeting-room-canvas-panel")).toBeInTheDocument();
    expect(screen.getByTestId(mockCanvasTestId)).toBeInTheDocument();
  });

  it("passes socket, userId, and userColor to CollaborativeCanvas", async () => {
    render(<MeetingRoom />, { wrapper });
    await joinMeeting();

    fireEvent.click(screen.getByRole("button", { name: /canvas/i }));

    const canvas = screen.getByTestId(mockCanvasTestId);
    expect(canvas).toHaveAttribute("data-socket", "connected");
    expect(canvas).toHaveAttribute("data-user-id", "mongo_user_canvas");
    expect(canvas).toHaveAttribute("data-user-color");
    // Color should be a hex string starting with #
    expect(canvas.getAttribute("data-user-color")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("closes canvas when clicking Canvas toggle again", async () => {
    render(<MeetingRoom />, { wrapper });
    await joinMeeting();

    const canvasBtn = screen.getByRole("button", { name: /canvas/i });

    // Open
    fireEvent.click(canvasBtn);
    expect(screen.getByTestId("meeting-room-canvas-panel")).toBeInTheDocument();

    // Close
    fireEvent.click(canvasBtn);
    expect(
      screen.queryByTestId("meeting-room-canvas-panel"),
    ).not.toBeInTheDocument();
  });

  it("switching to Notes closes canvas panel (exclusive panels)", async () => {
    render(<MeetingRoom />, { wrapper });
    await joinMeeting();

    // Open canvas
    fireEvent.click(screen.getByRole("button", { name: /canvas/i }));
    expect(screen.getByTestId("meeting-room-canvas-panel")).toBeInTheDocument();

    // Switch to notes
    fireEvent.click(screen.getByRole("button", { name: /^notes$/i }));
    expect(
      screen.queryByTestId("meeting-room-canvas-panel"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("meeting-room-notes-panel")).toBeInTheDocument();
  });

  it("Canvas toggle button is visible in the header", async () => {
    render(<MeetingRoom />, { wrapper });
    await joinMeeting();

    const canvasBtn = screen.getByRole("button", { name: /canvas/i });
    expect(canvasBtn).toBeInTheDocument();
    expect(canvasBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("Canvas toggle shows aria-pressed=true when open", async () => {
    render(<MeetingRoom />, { wrapper });
    await joinMeeting();

    const canvasBtn = screen.getByRole("button", { name: /canvas/i });
    fireEvent.click(canvasBtn);

    expect(canvasBtn).toHaveAttribute("aria-pressed", "true");
  });
});
