import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MeetingInsightsDashboard from "../MeetingInsightsDashboard.jsx";
import AppContent from "../../context/AppContent.js";

vi.mock("../meetingInsightsApi.js", () => ({
  fetchMeetingInsightsDashboard: vi.fn(),
  defaultInsightsDateRange: vi.fn(() => ({
    startDate: "2026-08-01",
    endDate: "2026-08-28",
  })),
}));

import { fetchMeetingInsightsDashboard } from "../meetingInsightsApi.js";

const renderDashboard = () =>
  render(
    <AppContent.Provider value={{ userData: { organization: "org-123" } }}>
      <MeetingInsightsDashboard />
    </AppContent.Provider>,
  );

const samplePayload = {
  stats: {
    totalMeetings: 12,
    totalHours: 24,
    totalActionItems: 8,
    avgAttendance: 82,
    efficiencyScore: 75,
    totalCost: 4200,
    activeMembers: 5,
  },
  insights: [
    {
      id: "attendance-summary",
      category: "attendance",
      title: "Average attendance 82%",
      description: "Sample insight",
      severity: "positive",
      value: 82,
      unit: "%",
      trend: "stable",
      changePercent: 0,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      source: "Attendance Analytics",
      confidence: 0.9,
      actionable: false,
      recommendedActions: [],
    },
  ],
  attendanceTrend: [
    { week: "2026-W01", rate: 80, avgParticipants: 5, totalMeetings: 3 },
  ],
  engagementData: [],
  meetingTypes: [{ type: "Standup", count: 4 }],
  weeklyMetrics: [{ week: "2026-W01", meetingsHeld: 3, costUsd: 500 }],
  sentimentTimeline: [],
  actionStats: {
    total: 8,
    completed: 6,
    inProgress: 1,
    overdue: 1,
    completionRate: 75,
    byPriority: { high: { total: 2, completed: 1 } },
  },
  efficiencyData: [],
};

describe("MeetingInsightsDashboard (#2439)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while insights are fetched", () => {
    fetchMeetingInsightsDashboard.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByText("Loading meeting insights...")).toBeInTheDocument();
  });

  it("renders API-backed summary metrics", async () => {
    fetchMeetingInsightsDashboard.mockResolvedValue(samplePayload);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Meeting Insights")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Meetings")).toBeInTheDocument();
    expect(fetchMeetingInsightsDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-123" }),
    );
  });

  it("shows error state with retry", async () => {
    fetchMeetingInsightsDashboard.mockRejectedValue(new Error("network"));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Unable to load insights")).toBeInTheDocument();
    });

    fetchMeetingInsightsDashboard.mockResolvedValue(samplePayload);
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));

    await waitFor(() => {
      expect(screen.getByText("Total Meetings")).toBeInTheDocument();
    });
  });
});
