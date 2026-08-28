import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SentimentTrends from "../SentimentTrends";
import AppContent from "../../context/AppContent";
import { organizationApi, sentimentTimelineApi } from "../../services";

vi.mock("../../context/useTheme.jsx", () => ({
  default: () => ({ theme: "light" }),
}));

vi.mock("../../components/Navbar", () => ({
  default: () => <nav data-testid="mock-navbar">Navbar</nav>,
}));

vi.mock("../../services", () => ({
  organizationApi: {
    getUserOrganizations: vi.fn(),
  },
  sentimentTimelineApi: {
    getOrgTrends: vi.fn(),
  },
}));

describe("SentimentTrends Page (#2039)", () => {
  const mockUserData = {
    _id: "u123",
    name: "Alex Leader",
    organization: "org-123",
  };

  const mockOrgs = [
    { _id: "org-123", name: "Engineering Org" },
    { _id: "org-456", name: "Product Org" },
  ];

  const mockTrendsData = {
    organizationId: "org-123",
    days: 30,
    summary: {
      averageScore: 0.45,
      totalMeetingsAnalyzed: 2,
      totalSegmentsAnalyzed: 8,
      positivePercent: 65,
      neutralPercent: 25,
      negativePercent: 10,
      trendDirection: "improving",
    },
    timeline: [
      {
        timelineId: "tl-1",
        meetingId: "m-1",
        title: "All Hands Q3",
        date: "2026-08-15T10:00:00.000Z",
        duration: 45,
        averageScore: 0.55,
        positiveCount: 4,
        neutralCount: 1,
        negativeCount: 0,
        overallArc: "High enthusiasm and alignment on company goals.",
      },
      {
        timelineId: "tl-2",
        meetingId: "m-2",
        title: "Architecture Review",
        date: "2026-08-18T14:00:00.000Z",
        duration: 60,
        averageScore: 0.35,
        positiveCount: 2,
        neutralCount: 2,
        negativeCount: 1,
        overallArc: "Constructive debate around database sharding.",
      },
    ],
    highlights: {
      mostPositiveMeeting: {
        meetingId: "m-1",
        title: "All Hands Q3",
        averageScore: 0.55,
        date: "2026-08-15T10:00:00.000Z",
        overallArc: "High enthusiasm and alignment on company goals.",
      },
      mostNegativeMeeting: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    organizationApi.getUserOrganizations.mockResolvedValue({
      data: { success: true, organizations: mockOrgs },
    });
    sentimentTimelineApi.getOrgTrends.mockResolvedValue({
      data: { success: true, data: mockTrendsData },
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: mockUserData }}>
          <SentimentTrends />
        </AppContent.Provider>
      </MemoryRouter>,
    );

  it("renders header, KPI metrics, and meeting breakdown", async () => {
    renderComponent();

    expect(
      screen.getByText(/Organization Sentiment Trends/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/\+0.45/i)).toBeInTheDocument();
      expect(screen.getAllByText(/All Hands Q3/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Architecture Review/i)).toBeInTheDocument();
      expect(screen.getAllByText(/65%/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/improving/i).length).toBeGreaterThan(0);
    });
  });

  it("switches time range filter", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/All Hands Q3/i).length).toBeGreaterThan(0);
    });

    const filter90d = screen.getByRole("button", { name: /90d/i });
    fireEvent.click(filter90d);

    await waitFor(() => {
      expect(sentimentTimelineApi.getOrgTrends).toHaveBeenCalledWith(
        "org-123",
        { days: 90 },
      );
    });
  });

  it("handles organization switching", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/All Hands Q3/i).length).toBeGreaterThan(0);
    });

    const select = screen.getByLabelText(/Filter by Organization/i);
    fireEvent.change(select, { target: { value: "org-456" } });

    await waitFor(() => {
      expect(sentimentTimelineApi.getOrgTrends).toHaveBeenCalledWith(
        "org-456",
        { days: 30 },
      );
    });
  });
});
