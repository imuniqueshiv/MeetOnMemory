import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SeriesEvolutionTimeline from "../SeriesEvolutionTimeline.jsx";
import apiClient from "../../../services/apiClient.js";

vi.mock("../../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock recharts responsive container to render in JSDOM
vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

describe("SeriesEvolutionTimeline (#2738)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when timeline array is empty", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        timeline: [],
        trendMetrics: {
          actionItemCompletionRate: 0,
          decisionVelocity: 0,
        },
      },
    });

    render(
      <MemoryRouter>
        <SeriesEvolutionTimeline seriesId="series_123" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No meetings found in this series."),
      ).toBeInTheDocument();
    });
  });

  it("renders error state when API call fails", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("Network Error"));

    render(
      <MemoryRouter>
        <SeriesEvolutionTimeline seriesId="series_123" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load series timeline."),
      ).toBeInTheDocument();
    });
  });

  it("renders meetings with React Router Link to /meeting/:id", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        timeline: [
          {
            meetingId: "m_101",
            title: "Architecture Planning Kickoff",
            occurrence: 1,
            date: "2026-03-01T10:00:00.000Z",
            diffSummary: {
              added: 5,
              removed: 0,
              carriedOver: 0,
              completedActionItems: 2,
            },
          },
          {
            meetingId: "m_102",
            title: "Architecture Planning Follow-up",
            occurrence: 2,
            date: "2026-03-08T10:00:00.000Z",
            diffSummary: {
              added: 3,
              removed: 1,
              carriedOver: 2,
              completedActionItems: 4,
            },
          },
        ],
        trendMetrics: {
          actionItemCompletionRate: 0.85,
          decisionVelocity: 3.5,
        },
      },
    });

    render(
      <MemoryRouter>
        <SeriesEvolutionTimeline seriesId="series_123" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Architecture Planning Kickoff"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Architecture Planning Follow-up"),
      ).toBeInTheDocument();
    });

    // Check trend metrics
    expect(screen.getByText("85.0%")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();

    // Check links target /meeting/:id (singular) and not /meetings/:id
    const link1 = screen.getByTestId("view-meeting-m_101");
    const link2 = screen.getByTestId("view-meeting-m_102");

    expect(link1).toHaveAttribute("href", "/meeting/m_101");
    expect(link2).toHaveAttribute("href", "/meeting/m_102");
  });
});
