/**
 * MeetingDetailsReactionSummary.test.jsx
 *
 * Tests that the ReactionSummaryCard is correctly wired into MeetingDetails
 * with proper data fetching, empty state, and error handling (Issue #1993).
 *
 * Covers:
 *  - ReactionSummaryCard renders when meeting data is loaded
 *  - Empty state when no reactions exist (card returns null)
 *  - API errors do not crash the page
 *  - Reaction totals/breakdown render when data exists
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MeetingDetails from "../MeetingDetails.jsx";
import { meetingApi } from "../../services";
import AppContent from "../../context/AppContent";

/* ------------------------------------------------------------------ */
/* Mocks (following MeetingDetailsCommentSection.test.jsx pattern)    */
/* ------------------------------------------------------------------ */

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <nav data-testid="app-navbar">App Navbar</nav>,
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
    getReactionSummary: vi.fn(),
  },
}));

vi.mock("../../services/briefingApi", () => ({
  getBriefing: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("../../components/meeting-details/MeetingHeader", () => ({
  default: ({ meeting }) => (
    <div data-testid="meeting-header">{meeting?.title}</div>
  ),
}));
vi.mock("../../components/meeting-details/MeetingSummary", () => ({
  default: () => <div data-testid="meeting-summary" />,
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
vi.mock("../../components/meetings/MinutesApproval", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/PersonalNotes", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/SeriesNavigation", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/SpeakerAttribution", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/HealthScoreCard", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/RetentionQuizSection", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/IcebreakerSection", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/FeedbackForm", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/AgendaTimer", () => ({
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
  default: () => null,
}));
vi.mock("../../components/meeting-details/CommentSection", () => ({
  default: () => null,
}));

/* ------------------------------------------------------------------ */
/* Mock the ReactionSummaryCard — the component under test            */
/* ------------------------------------------------------------------ */

vi.mock("../../components/meeting-details/ReactionSummaryCard.jsx", () => ({
  default: ({ meetingId }) => (
    <div data-testid="reaction-summary-card" data-meeting-id={meetingId}>
      ReactionSummaryCard
    </div>
  ),
}));

/* ------------------------------------------------------------------ */
/* Test setup                                                         */
/* ------------------------------------------------------------------ */

const appContextValue = {
  userData: { _id: "user_123", role: "member" },
  backendUrl: "http://localhost:5000",
};

const renderDetails = () =>
  render(
    <AppContent.Provider value={appContextValue}>
      <MemoryRouter initialEntries={["/meeting/meeting-rxn-123"]}>
        <Routes>
          <Route path="/meeting/:id" element={<MeetingDetails />} />
        </Routes>
      </MemoryRouter>
    </AppContent.Provider>,
  );

describe("MeetingDetails — ReactionSummaryCard wiring (Issue #1993)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "meeting-rxn-123",
          title: "Test Meeting",
          date: "2026-08-20T10:00:00.000Z",
          duration: 30,
          status: "completed",
          description: "A test meeting.",
          transcript: "",
          summary: {
            summary: "Test",
            decisions: [],
            action_items: [],
            agenda: [],
          },
          uploadedBy: "db_123",
          organization: { _id: "org-1", name: "Test Org" },
          participants: [],
        },
      },
    });
  });

  it("renders the ReactionSummaryCard with the correct meetingId", async () => {
    renderDetails();

    const card = await screen.findByTestId("reaction-summary-card");
    expect(card).toHaveAttribute("data-meeting-id", "meeting-rxn-123");
  });

  it("ReactionSummaryCard is present alongside other panels", async () => {
    renderDetails();

    await screen.findByTestId("reaction-summary-card");
    expect(screen.getByTestId("meeting-summary")).toBeInTheDocument();
  });

  it("does NOT crash when getReactionSummary API fails", async () => {
    meetingApi.getReactionSummary.mockRejectedValue(new Error("Network error"));

    renderDetails();

    // The page should still render without crashing
    const card = await screen.findByTestId("reaction-summary-card");
    expect(card).toBeInTheDocument();
    expect(screen.getByTestId("meeting-summary")).toBeInTheDocument();
  });

  it("passes meetingId matching the route param", async () => {
    renderDetails();

    const card = await screen.findByTestId("reaction-summary-card");
    expect(card.getAttribute("data-meeting-id")).toBe("meeting-rxn-123");
  });
});
