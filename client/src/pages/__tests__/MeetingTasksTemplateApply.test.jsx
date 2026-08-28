import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MeetingDetails from "../MeetingDetails.jsx";
import { meetingApi } from "../../services";
import AppContent from "../../context/AppContent";
import {
  getTemplates,
  applyTemplateToMeeting,
} from "../../services/actionItemTemplateApi";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="app-navbar">App Navbar</div>,
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    user: { id: "user_123", publicMetadata: { dbUserId: "db_123" } },
  }),
}));

vi.mock("../../services/briefingApi", () => ({
  getBriefing: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("../../services/actionItemTemplateApi", () => ({
  getTemplates: vi.fn(),
  applyTemplateToMeeting: vi.fn(),
}));

const mockFetchMeetingItems = vi.fn();
vi.mock("../../hooks/useActionItems", () => ({
  useActionItems: () => ({
    items: [],
    isLoading: false,
    fetchItems: vi.fn(),
    fetchMeetingItems: mockFetchMeetingItems,
    updateItem: vi.fn(),
  }),
}));

vi.mock("../../services", () => ({
  meetingApi: {
    getMeetingById: vi.fn(),
    deleteMeeting: vi.fn(),
    updateMeeting: vi.fn(),
  },
}));

// Mock out heavy child panels we don't care about testing
vi.mock("../../components/meeting-details/MeetingHeader", () => ({
  default: () => <div data-testid="meeting-header">Meeting Header</div>,
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
vi.mock("../../components/meeting-details/ReactionSummaryCard", () => ({
  default: () => null,
}));
vi.mock("../../components/export/ExportDialog", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/SkillEndorsementModal", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/ConvertToAsyncModal", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/PrintMomModal.jsx", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/RetentionQuizSection", () => ({
  default: () => null,
}));
vi.mock("../../components/MeetingDetails/ParticipantContributions", () => ({
  default: () => null,
}));
vi.mock("../../components/MeetingDetails/ContributionSummaryPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/AbsenteeBriefingCard", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/MeetingCostCard", () => ({
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
vi.mock("../../components/meetings/AgendaBuilder", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/IcebreakerSection", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/AgendaTimer", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/AttachmentPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/DigestActions", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/GuestAccessManager", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/DelegationPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meetings/MeetingRisksPanel", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/TopicSummary", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/ClipManager", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/FollowUpThreads", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/CommentSection", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/PollSection", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/FeedbackForm", () => ({
  default: () => null,
}));
vi.mock("../../components/meeting-details/SentimentTimeline", () => ({
  default: () => null,
}));

const mockMeeting = {
  _id: "meeting_123",
  title: "Test Project Alignment Meeting",
  date: "2026-08-25T10:00:00Z",
  duration: 60,
  status: "completed",
  organization: { _id: "org_123", name: "Test Org" },
  uploadedBy: "db_123",
  participants: [{ user: "db_123", name: "Organizer User", role: "host" }],
};

const mockTemplates = [
  {
    _id: "tpl_123",
    name: "Engineering Sync Template",
    applicableMeetingTypes: ["conference"],
    items: [
      {
        text: "Submit status updates",
        description: "Post status report to Slack channel",
        daysToComplete: 2,
        defaultOwnerRole: "host",
      },
    ],
  },
];

describe("MeetingDetails — Apply Action Item Template UI integration (#2473)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingApi.getMeetingById.mockResolvedValue({ data: mockMeeting });
  });

  it("renders tasks panel and supports applying templates with preview and confirmation", async () => {
    getTemplates.mockResolvedValue(mockTemplates);
    applyTemplateToMeeting.mockResolvedValue({ createdCount: 1 });

    render(
      <AppContent.Provider
        value={{ userData: { _id: "db_123", role: "admin" } }}
      >
        <MemoryRouter initialEntries={["/meeting/meeting_123"]}>
          <Routes>
            <Route path="/meeting/:id" element={<MeetingDetails />} />
          </Routes>
        </MemoryRouter>
      </AppContent.Provider>,
    );

    // Verify Tasks & Action Items title
    expect(await screen.findByText("Tasks & Action Items")).toBeInTheDocument();

    // Verify Apply Template button is rendered
    const applyBtn = screen.getByTestId("apply-template-btn");
    expect(applyBtn).toBeInTheDocument();

    // Click Apply Template button
    fireEvent.click(applyBtn);

    // Verify modal title is displayed
    expect(
      await screen.findByText("Apply Action Item Template"),
    ).toBeInTheDocument();
    expect(getTemplates).toHaveBeenCalled();

    // Click template option to view preview
    const tplOption = await screen.findByText("Engineering Sync Template");
    fireEvent.click(tplOption);

    // Verify template task details are previewed
    expect(
      await screen.findByText("Preview: Engineering Sync Template"),
    ).toBeInTheDocument();
    expect(screen.getByText("Submit status updates")).toBeInTheDocument();
    expect(
      screen.getByText("Post status report to Slack channel"),
    ).toBeInTheDocument();
    expect(screen.getByText("Owner Role:")).toBeInTheDocument();

    // Confirm apply
    const confirmBtn = screen.getByTestId("confirm-apply-btn");
    fireEvent.click(confirmBtn);

    // Verify API is triggered and items re-fetched
    await waitFor(() => {
      expect(applyTemplateToMeeting).toHaveBeenCalledWith(
        "tpl_123",
        "meeting_123",
      );
      expect(mockFetchMeetingItems).toHaveBeenCalledWith("meeting_123");
    });
  });
});
