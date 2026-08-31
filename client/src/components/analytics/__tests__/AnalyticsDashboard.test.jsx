import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AnalyticsDashboard from "../AnalyticsDashboard.jsx";
import apiClient from "../../../services/apiClient.js";

vi.mock("../../../services/apiClient.js");

describe("AnalyticsDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", async () => {
    apiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<AnalyticsDashboard teamId="team-123" />);

    const loaders = screen.getAllByRole("generic");
    expect(loaders.length).toBeGreaterThan(0);
  });

  it("renders summary cards and recent meetings when API calls succeed", async () => {
    const mockSummary = {
      data: {
        success: true,
        data: {
          avgEngagement: 85.5,
          avgEfficiency: 92.3,
          totalMeetings: 15,
          avgDuration: 45.2,
        },
      },
    };

    const mockRecentMeetings = {
      data: {
        success: true,
        data: {
          meetings: [
            {
              _id: "meet-1",
              title: "Weekly Engineering Sync",
              date: "2026-08-30T10:00:00.000Z",
              duration: 30,
              analytics: {
                engagementScore: 88,
                efficiencyScore: 94,
              },
            },
          ],
        },
      },
    };

    apiClient.get
      .mockResolvedValueOnce(mockSummary)
      .mockResolvedValueOnce(mockRecentMeetings);

    render(<AnalyticsDashboard teamId="team-123" />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Engineering Sync")).toBeInTheDocument();
    });

    expect(screen.getByText("Avg. Engagement")).toBeInTheDocument();
    expect(screen.getByText("86")).toBeInTheDocument(); // Math.round(85.5) = 86
    expect(screen.getByText("Avg. Efficiency")).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument(); // Math.round(92.3) = 92
    expect(screen.getByText("Total Meetings")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("Avg. Duration")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument(); // Math.round(45.2) = 45
  });

  it("renders error state when API call fails", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("API failure"));

    render(<AnalyticsDashboard teamId="team-123" />);

    await waitFor(() => {
      expect(screen.getByText("Error Loading Analytics")).toBeInTheDocument();
    });

    expect(screen.getByText("API failure")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
  });

  it("handles retry action on error", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("API failure"));

    render(<AnalyticsDashboard teamId="team-123" />);

    await waitFor(() => {
      expect(screen.getByText("Error Loading Analytics")).toBeInTheDocument();
    });

    const mockSummary = {
      data: {
        success: true,
        data: {
          avgEngagement: 80,
          avgEfficiency: 90,
          totalMeetings: 5,
          avgDuration: 20,
        },
      },
    };

    const mockRecent = {
      data: {
        success: true,
        data: { meetings: [] },
      },
    };

    apiClient.get
      .mockResolvedValueOnce(mockSummary)
      .mockResolvedValueOnce(mockRecent);

    const retryBtn = screen.getByRole("button", { name: "Try Again" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("No meetings analyzed yet.")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Error Loading Analytics"),
    ).not.toBeInTheDocument();
  });
});
