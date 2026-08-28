import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingDetails from "../MeetingDetails.jsx";

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
  default: () => <div>MeetingSummary</div>,
}));
vi.mock("../../components/meeting-details/MeetingCollaborativeNotes", () => ({
  default: () => <div>MeetingCollaborativeNotes</div>,
}));
vi.mock("../../components/meeting-details/MeetingTranscript", () => ({
  default: () => <div>MeetingTranscript</div>,
}));
vi.mock("../../components/meeting-details/MeetingParticipants", () => ({
  default: () => <div>MeetingParticipants</div>,
}));
vi.mock("../../components/meeting-details/MeetingAgenda", () => ({
  default: () => <div>MeetingAgenda</div>,
}));
vi.mock("../../components/meeting-details/MeetingMetadata", () => ({
  default: () => <div>MeetingMetadata</div>,
}));
vi.mock("../../components/meeting-details/MeetingActions", () => ({
  default: () => <div>MeetingActions</div>,
}));
vi.mock("../../components/meeting-details/TranscriptAnnotations", () => ({
  default: () => <div>TranscriptAnnotations</div>,
}));
vi.mock("../../components/meeting-details/RsvpPanel", () => ({
  default: () => <div>RsvpPanel</div>,
}));
vi.mock("../../components/meetings/KeyMomentsPanel", () => ({
  default: () => <div>KeyMomentsPanel</div>,
}));
vi.mock("../../components/meetings/HighlightReel", () => ({
  default: () => <div>HighlightReel</div>,
}));
vi.mock("../../components/meetings/SentimentTimeline", () => ({
  default: () => <div>SentimentTimeline</div>,
}));
vi.mock("../../components/meetings/MeetingGoalsPanel", () => ({
  default: () => <div>MeetingGoalsPanel</div>,
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
vi.mock("../../components/meeting-details/DuplicateDetectionPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/CommentSection", () => ({
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
  default: ({ meetingId }) => (
    <div data-testid="poll-section">Polls for {meetingId}</div>
  ),
}));
vi.mock("../../components/meeting-details/FeedbackForm", () => ({
  default: ({ meetingId, organizationId }) => (
    <div
      data-testid="meeting-feedback-form"
      data-meeting-id={meetingId}
      data-organization-id={organizationId || ""}
    >
      Feedback for {meetingId}
    </div>
  ),
}));
vi.mock("../../components/meeting-details/AgendaTimer", () => ({
  default: ({ meeting, readOnly }) => (
    <div
      data-testid="agenda-timer"
      data-meeting-id={meeting?._id}
      data-readonly={readOnly ? "yes" : "no"}
    >
      Agenda for {meeting?._id}
    </div>
  ),
}));
vi.mock("../../components/meeting-details/HealthScoreCard", () => ({
  default: ({ meetingId, organizationId }) => (
    <div
      data-testid="meeting-health-score-card"
      data-meeting-id={meetingId}
      data-organization-id={organizationId || ""}
    >
      Health for {meetingId}
    </div>
  ),
}));
vi.mock("../../components/meeting-details/AgendaPacingReport", () => ({
  default: ({ meetingId }) => (
    <div data-testid="agenda-pacing-report" data-meeting-id={meetingId}>
      Pacing for {meetingId}
    </div>
  ),
}));
vi.mock("../../components/meeting-details/ClipManager", () => ({
  default: ({ meetingId, canManage }) => (
    <div
      data-testid="clip-manager"
      data-meeting-id={meetingId}
      data-can-manage={canManage ? "yes" : "no"}
    >
      Clips for {meetingId}
    </div>
  ),
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

import { meetingApi } from "../../services";

describe("MeetingDetails Navbar Integration (#1637)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Navbar in loading state", () => {
    meetingApi.getMeetingById.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/meetings/123"]}>
        <Routes>
          <Route path="/meetings/:id" element={<MeetingDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("app-navbar")).toBeInTheDocument();
  });

  it("renders Navbar when meeting details are loaded", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "123",
          title: "Quarterly Planning",
          uploadedBy: "db_123",
          participants: [],
          organization: { _id: "org-42" },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/meetings/123"]}>
        <Routes>
          <Route path="/meetings/:id" element={<MeetingDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("app-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("meeting-header")).toHaveTextContent(
      "Quarterly Planning",
    );
    expect(screen.getByTestId("poll-section")).toHaveTextContent(
      "Polls for 123",
    );
    const feedbackForm = screen.getByTestId("meeting-feedback-form");
    expect(feedbackForm).toHaveTextContent("Feedback for 123");
    expect(feedbackForm).toHaveAttribute("data-meeting-id", "123");
    expect(feedbackForm).toHaveAttribute("data-organization-id", "org-42");
    const agendaTimer = screen.getByTestId("agenda-timer");
    expect(agendaTimer).toHaveTextContent("Agenda for 123");
    expect(agendaTimer).toHaveAttribute("data-meeting-id", "123");
    expect(agendaTimer).toHaveAttribute("data-readonly", "yes");
    const healthCard = screen.getByTestId("meeting-health-score-card");
    expect(healthCard).toHaveTextContent("Health for 123");
    expect(healthCard).toHaveAttribute("data-meeting-id", "123");
    expect(healthCard).toHaveAttribute("data-organization-id", "org-42");
  });

  it("renders Navbar in error state", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: false,
        message: "Failed to fetch meeting",
      },
    });

    render(
      <MemoryRouter initialEntries={["/meetings/123"]}>
        <Routes>
          <Route path="/meetings/:id" element={<MeetingDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("app-navbar")).toBeInTheDocument();
    expect(screen.getByText("Error Loading Meeting")).toBeInTheDocument();
  });
});
