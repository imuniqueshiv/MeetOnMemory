import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MeetingDetails from "../MeetingDetails.jsx";
import { meetingApi } from "../../services";

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
  default: ({ meetingId }) => (
    <div data-testid="agenda-pacing-report" data-meeting-id={meetingId}>
      Pacing for {meetingId}
    </div>
  ),
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

const renderDetails = () =>
  render(
    <MemoryRouter initialEntries={["/meetings/123"]}>
      <Routes>
        <Route path="/meetings/:id" element={<MeetingDetails />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Meeting Details AgendaPacingReport mount (#1986)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the pacing report for a completed meeting with the meeting id", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "123",
          title: "Quarterly Planning",
          status: "completed",
          uploadedBy: "db_123",
          participants: [],
        },
      },
    });

    renderDetails();

    const report = await screen.findByTestId("agenda-pacing-report");
    expect(report).toHaveTextContent("Pacing for 123");
    expect(report).toHaveAttribute("data-meeting-id", "123");
  });

  it("renders the pacing report after the scheduled meeting window has ended", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "123",
          title: "Past Sync",
          status: "uploaded",
          date: "2020-01-01T10:00:00.000Z",
          duration: 60,
          uploadedBy: "db_123",
          participants: [],
        },
      },
    });

    renderDetails();

    expect(await screen.findByTestId("agenda-pacing-report")).toHaveAttribute(
      "data-meeting-id",
      "123",
    );
  });

  it("does not show the post-meeting report for an upcoming meeting", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "123",
          title: "Upcoming Sync",
          status: "uploaded",
          date: "2099-01-01T10:00:00.000Z",
          duration: 60,
          uploadedBy: "db_123",
          participants: [],
        },
      },
    });

    renderDetails();

    expect(await screen.findByTestId("meeting-header")).toHaveTextContent(
      "Upcoming Sync",
    );
    expect(
      screen.queryByTestId("agenda-pacing-report"),
    ).not.toBeInTheDocument();
  });
});
