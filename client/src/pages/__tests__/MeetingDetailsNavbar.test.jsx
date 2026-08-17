import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MeetingDetails from "../MeetingDetails.jsx";
import { meetingApi } from "../../services";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <nav data-testid="shared-navbar">Shared Navbar</nav>,
}));

vi.mock("../../components/summaries/RecapStoryViewer", () => ({
  default: () => <div data-testid="recap-story-viewer" />,
}));

vi.mock("../../components/meetings/PrepChecklist", () => ({
  default: () => <div data-testid="prep-checklist" />,
}));

vi.mock("../../components/meetings/KeyMomentsPanel", () => ({
  default: () => <div data-testid="key-moments-panel" />,
}));

vi.mock("../../components/meetings/MeetingGoalsPanel", () => ({
  default: () => <div data-testid="meeting-goals-panel" />,
}));

vi.mock("../../components/meetings/SentimentTimeline", () => ({
  default: () => <div data-testid="sentiment-timeline" />,
}));

vi.mock("../../components/meetings/SpeakingTimeBreakdown", () => ({
  default: () => <div data-testid="speaking-time-breakdown" />,
}));

vi.mock("../../components/meetings/CarryForwardConfig", () => ({
  default: () => <div data-testid="carry-forward-config" />,
}));

vi.mock("../../components/meeting-details/TranscriptAnnotations", () => ({
  default: () => <div data-testid="transcript-annotations" />,
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: { id: "u_1", name: "Alice" } }),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("mock_token") }),
}));

vi.mock("../../services", () => ({
  meetingApi: {
    getMeetingById: vi.fn(),
    updateMeetingNotes: vi.fn(),
    updateMeetingSummary: vi.fn(),
    updateMeeting: vi.fn(),
  },
}));

vi.mock("../../services/briefingApi", () => ({
  getBriefing: vi.fn().mockResolvedValue({ status: "none" }),
}));

describe("MeetingDetails Navbar Integration (#1637)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the shared Navbar on MeetingDetails page", async () => {
    meetingApi.getMeetingById.mockResolvedValue({
      data: {
        success: true,
        meeting: {
          _id: "m_1",
          title: "Quarterly Review",
          date: "2026-08-10",
          time: "10:00 AM",
          summary: "Summary text",
          participants: [],
          agenda: [],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/meetings/m_1"]}>
        <Routes>
          <Route path="/meetings/:id" element={<MeetingDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("shared-navbar")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Quarterly Review")).toBeInTheDocument();
    });

    expect(screen.getByTestId("shared-navbar")).toBeInTheDocument();
  });
});
