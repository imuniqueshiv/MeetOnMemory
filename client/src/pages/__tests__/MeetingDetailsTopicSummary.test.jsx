import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MeetingDetails from "../MeetingDetails.jsx";
import { meetingApi } from "../../services";
import AppContent from "../../context/AppContent";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="app-navbar">App Navbar</div>,
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    user: { id: "user_123", publicMetadata: { dbUserId: "db_123" } },
  }),
}));

vi.mock("../../services", () => ({
  meetingApi: {
    getMeetingById: vi.fn(),
    deleteMeeting: vi.fn(),
    updateMeeting: vi.fn(),
  },
}));

vi.mock("../../services/briefingApi", () => ({
  getBriefing: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("../../components/meeting-details/MeetingHeader", () => ({
  default: ({ meeting }) => (
    <div data-testid="meeting-header">{meeting.title}</div>
  ),
}));
vi.mock("../../components/meeting-details/MeetingSummary", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingCollaborativeNotes", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingTranscript", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingParticipants", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingAgenda", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingMetadata", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingActions", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/TranscriptAnnotations", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/RsvpPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/KeyMomentsPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/HighlightReel", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/SentimentTimeline", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/MeetingGoalsPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/shared-links/ShareModal", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingFollowUpBanner", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/PresentMode", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/PrepChecklist", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/SpeakingTimeBreakdown", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/CarryForwardConfig", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/RoleRotationConfig", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/DuplicateDetectionPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingTimeline", () => ({
  default: () => null,
}));
vi.mock("../../components/summaries/RecapStoryViewer", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/BriefingBanner", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/AgendaBuilder", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/GuestAccessManager", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/PollSection", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/FeedbackForm", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/AgendaTimer", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/HealthScoreCard", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/MinutesApproval", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/PersonalNotes", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/FollowUpThreads", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/MeetingRisksPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/MeetingReadiness", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/AgendaPacingReport", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/ClipManager", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/AttachmentPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/DigestActions", () => ({
  default: () => null,
}));

vi.mock("../../components/meeting-details/TopicSummary", () => ({
  default: ({ meetingId, canExtract }) => (
    <div
      data-testid="topic-summary"
      data-meeting-id={meetingId}
      data-can-extract={canExtract ? "yes" : "no"}
    >
      Topics for {meetingId}
    </div>
  ),
}));

const renderDetails = (userData = { _id: "user-1", role: "member" }) =>
  render(
    <AppContent.Provider value={{ userData }}>
      <MemoryRouter initialEntries={["/meetings/123"]}>
        <Routes>
          <Route path="/meetings/:id" element={<MeetingDetails />} />
        </Routes>
      </MemoryRouter>
    </AppContent.Provider>,
  );

describe("Meeting Details TopicSummary mount (#1996)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mounts TopicSummary with the meeting id for members", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "123",
          title: "Quarterly Planning",
          uploadedBy: "db_123",
          participants: [],
        },
      },
    });

    renderDetails();

    const panel = await screen.findByTestId("topic-summary");
    expect(panel).toHaveTextContent("Topics for 123");
    expect(panel).toHaveAttribute("data-meeting-id", "123");
    expect(panel).toHaveAttribute("data-can-extract", "yes");
  });

  it("mounts TopicSummary without extract permission for viewers", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "123",
          title: "Quarterly Planning",
          uploadedBy: "someone-else",
          participants: [],
        },
      },
    });

    renderDetails({ _id: "viewer-1", role: "viewer" });

    const panel = await screen.findByTestId("topic-summary");
    expect(panel).toHaveAttribute("data-can-extract", "no");
  });
});
