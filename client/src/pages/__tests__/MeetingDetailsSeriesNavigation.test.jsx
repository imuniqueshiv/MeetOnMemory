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

const appContextValue = {
  userData: { _id: "user-1", role: "member" },
  backendUrl: "http://localhost:5000",
};

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
vi.mock("../../components/meeting-details/CommentSection", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/SpeakerAttribution", () => ({
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
  default: () => null,
}));

vi.mock("../../components/meeting-details/SeriesNavigation", () => ({
  default: ({ meeting }) => (
    <div
      data-testid="series-navigation"
      data-meeting-id={meeting?._id}
      data-series-id={
        meeting?.series?._id || meeting?.series || meeting?.seriesId || ""
      }
    >
      Series nav for {meeting?._id}
    </div>
  ),
}));

const renderDetails = (path = "/meeting/123") =>
  render(
    <AppContent.Provider value={appContextValue}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/meeting/:id" element={<MeetingDetails />} />
        </Routes>
      </MemoryRouter>
    </AppContent.Provider>,
  );

describe("Meeting Details SeriesNavigation mount (#1994)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mounts SeriesNavigation for series meetings", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "123",
          title: "Weekly Sync #2",
          uploadedBy: "db_123",
          participants: [],
          series: "series-1",
        },
      },
    });

    renderDetails();

    const nav = await screen.findByTestId("series-navigation");
    expect(nav).toHaveTextContent("Series nav for 123");
    expect(nav).toHaveAttribute("data-series-id", "series-1");
  });

  it("does not mount SeriesNavigation for non-series meetings", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "456",
          title: "One-off Meeting",
          uploadedBy: "db_123",
          participants: [],
        },
      },
    });

    renderDetails("/meeting/456");

    expect(await screen.findByTestId("meeting-header")).toHaveTextContent(
      "One-off Meeting",
    );
    expect(screen.queryByTestId("series-navigation")).not.toBeInTheDocument();
  });
});
