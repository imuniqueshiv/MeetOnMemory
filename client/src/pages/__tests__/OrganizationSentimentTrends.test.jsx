import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import OrganizationSentimentTrends from "../OrganizationSentimentTrends.jsx";
import apiClient from "../../services/apiClient.js";
import AppContent from "../../context/AppContent.js";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <nav data-testid="shared-navbar">Shared Navbar</nav>,
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("OrganizationSentimentTrends Page (#2039)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUserContext = {
    userData: {
      _id: "u_1",
      organization: "org_123",
    },
  };

  it("renders sentiment trends overview KPIs and breakdown table", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          organizationId: "org_123",
          range: "30d",
          totalMeetings: 2,
          analyzedMeetings: 2,
          overallAverageScore: 0.85,
          trends: [
            {
              meetingId: "m_1",
              title: "Product Strategy Sync",
              date: "2026-08-20",
              averageScore: 0.85,
              hasSentiment: true,
              dataPointsCount: 5,
            },
          ],
        },
      },
    });

    render(
      <BrowserRouter>
        <AppContent.Provider value={mockUserContext}>
          <OrganizationSentimentTrends />
        </AppContent.Provider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("shared-navbar")).toBeInTheDocument();
      expect(
        screen.getByText("Organization Sentiment Trends"),
      ).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("Product Strategy Sync")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("region", { name: "Organization Sentiment Header" }),
    ).toBeInTheDocument();
  });

  it("displays error card on fetch error and retries", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("Network Error"));

    render(
      <BrowserRouter>
        <AppContent.Provider value={mockUserContext}>
          <OrganizationSentimentTrends />
        </AppContent.Provider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sentiment-error-card")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Failed to load organization sentiment trends. Please try again.",
        ),
      ).toBeInTheDocument();
    });
  });
});
