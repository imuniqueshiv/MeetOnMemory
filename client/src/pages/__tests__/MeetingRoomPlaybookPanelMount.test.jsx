import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingRoom from "../MeetingRoom.jsx";
import AppContent from "../../context/AppContent.js";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ roomId: "room-playbook-123" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isSignedIn: true,
    isLoaded: true,
    userId: "user_1",
  }),
}));

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    id: "socket_1",
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
    auth: { token: "token_1" },
    transports: ["websocket"],
  })),
  getClerkBearerToken: vi.fn(async () => "token_1"),
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
    socketRef: { current: { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() } },
    userVideoRef: { current: null },
    streamRef: { current: null },
  }),
}));

vi.mock("../../hooks/useLiveTranscription", () => ({
  default: () => ({
    toggleTranscription: vi.fn(),
  }),
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
  default: ({ compact }) => (
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

vi.mock("../../components/meeting-room/MeetingRoomPlaybookPanel.jsx", () => ({
  default: () => (
    <div data-testid="meeting-room-playbook-content">Playbook Panel</div>
  ),
}));

const wrapper = ({ children }) => (
  <AppContent.Provider
    value={{
      userData: { _id: "mongo_user_1", name: "Alice", role: "member" },
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

describe("MeetingRoom playbook panel mount (#2447)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the playbook side panel from the meeting header", async () => {
    render(<MeetingRoom />, { wrapper });
    await joinMeeting();

    fireEvent.click(screen.getByRole("button", { name: /^playbook$/i }));

    expect(
      screen.getByTestId("meeting-room-playbook-panel"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("meeting-room-playbook-content"),
    ).toBeInTheDocument();
  });
});
