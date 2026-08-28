import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingDetails from "../MeetingDetails.jsx";
import MeetingActions from "../../components/meeting-details/MeetingActions.jsx";
import { meetingApi } from "../../services";
import { getBriefing } from "../../services/briefingApi";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "meeting-123" }),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    user: {
      id: "user_test",
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
    isSignedIn: true,
  }),
  useAuth: () => ({ userId: "user_test", getToken: vi.fn() }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("../../components/summaries/RecapStoryViewer.jsx", () => ({
  default: () => null,
}));

vi.mock("../../components/meeting-details/PollSection.jsx", () => ({
  default: ({ meetingId }) => (
    <div data-testid="poll-section">Polls for {meetingId}</div>
  ),
}));

vi.mock("../../components/meeting-details/FeedbackForm.jsx", () => ({
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

vi.mock("../../components/meeting-details/AgendaTimer.jsx", () => ({
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

vi.mock("../../components/meeting-details/HealthScoreCard.jsx", () => ({
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

vi.mock("../../components/meeting-details/AgendaPacingReport.jsx", () => ({
  default: ({ meetingId }) => (
    <div data-testid="agenda-pacing-report" data-meeting-id={meetingId}>
      Pacing for {meetingId}
    </div>
  ),
}));

vi.mock("../../components/meeting-details/ClipManager.jsx", () => ({
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

vi.mock("../../components/meeting-details/AttachmentPanel.jsx", () => ({
  default: () => null,
}));

vi.mock("../../components/meeting-details/DigestActions.jsx", () => ({
  default: () => null,
}));

vi.mock("../../components/meeting-details/TopicSummary.jsx", () => ({
  default: () => null,
}));

vi.mock("../../services", () => ({
  meetingApi: {
    getMeetingById: vi.fn(),
    deleteMeeting: vi.fn(),
    updateMeeting: vi.fn(),
  },
}));

vi.mock("../../services/briefingApi", () => ({
  getBriefing: vi.fn().mockResolvedValue({ data: {} }),
}));

describe("Meeting Details Back / Error Navigation (#1655)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBriefing.mockResolvedValue({ data: {} });
    // Default history state with no previous SPA entry
    window.history.replaceState({ idx: 0 }, "");
  });

  it("navigates to /meetings when Back CTA clicked on error state with direct URL", async () => {
    meetingApi.getMeetingById.mockRejectedValueOnce({
      response: { data: { message: "Meeting load failure" } },
    });

    render(<MeetingDetails />);

    await waitFor(() => {
      expect(screen.getByText("Error Loading Meeting")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", {
      name: /back to meetings/i,
    });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/meetings");
    expect(mockNavigate).not.toHaveBeenCalledWith("/summaries");
  });

  it("navigates back (-1) on error state when browser history exists", async () => {
    window.history.replaceState({ idx: 2 }, "");
    meetingApi.getMeetingById.mockRejectedValueOnce({
      response: { data: { message: "Meeting load failure" } },
    });

    render(<MeetingDetails />);

    await waitFor(() => {
      expect(screen.getByText("Error Loading Meeting")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", {
      name: /back to meetings/i,
    });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(mockNavigate).not.toHaveBeenCalledWith("/summaries");
  });

  it("navigates to /meetings when meeting not found on direct URL", async () => {
    meetingApi.getMeetingById.mockResolvedValueOnce({
      data: { success: true, meeting: null },
    });

    render(<MeetingDetails />);

    await waitFor(() => {
      expect(screen.getByText("Meeting Not Found")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", {
      name: /back to meetings/i,
    });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/meetings");
    expect(mockNavigate).not.toHaveBeenCalledWith("/summaries");
  });

  it("MeetingActions back button navigates back (-1) when history exists and /meetings as fallback", () => {
    // 1. Direct URL (idx 0)
    window.history.replaceState({ idx: 0 }, "");
    const { unmount } = render(
      <MeetingActions
        meeting={{ _id: "123", title: "Test" }}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    const backButton = screen.getByRole("button", {
      name: /back to meeting repository/i,
    });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/meetings");
    expect(mockNavigate).not.toHaveBeenCalledWith("/summaries");

    unmount();
    mockNavigate.mockClear();

    // 2. Navigated in app (idx > 0)
    window.history.replaceState({ idx: 3 }, "");
    render(
      <MeetingActions
        meeting={{ _id: "123", title: "Test" }}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    const backButton2 = screen.getByRole("button", {
      name: /back to meeting repository/i,
    });
    fireEvent.click(backButton2);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(mockNavigate).not.toHaveBeenCalledWith("/summaries");
  });
});
