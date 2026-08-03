import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import SeriesNavigation from "../SeriesNavigation.jsx";
import { meetingSeriesApi } from "../../../services";

vi.mock("../../../services", () => ({
  meetingSeriesApi: {
    getSeriesById: vi.fn(),
    getSeriesMeetings: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe("SeriesNavigation Component (Issue #915)", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it("renders accurate total count and allows navigation beyond 100 meetings", async () => {
    const mockSeriesId = "series-123";
    const currentMeeting = {
      _id: "meeting-105",
      series: mockSeriesId,
      seriesOccurrence: 105,
    };

    const mockSeriesData = {
      data: {
        success: true,
        series: {
          _id: mockSeriesId,
          title: "Engineering Sync",
        },
      },
    };

    // Generate 120 meetings payload
    const mockMeetingsList = Array.from({ length: 120 }, (_, i) => ({
      _id: `meeting-${i + 1}`,
      title: `Engineering Sync #${i + 1}`,
      seriesOccurrence: i + 1,
    }));

    const mockMeetingsData = {
      data: {
        success: true,
        meetings: mockMeetingsList,
        pagination: {
          total: 120,
          page: 1,
          pages: 1,
        },
      },
    };

    meetingSeriesApi.getSeriesById.mockResolvedValueOnce(mockSeriesData);
    meetingSeriesApi.getSeriesMeetings.mockResolvedValueOnce(mockMeetingsData);

    render(
      <MemoryRouter>
        <SeriesNavigation meeting={currentMeeting} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(meetingSeriesApi.getSeriesMeetings).toHaveBeenCalledWith(
        mockSeriesId,
        1,
        0,
      );
      expect(
        screen.getByText(/Engineering Sync \(Recurring Series\)/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Meeting 105 of 120/i)).toBeInTheDocument();
    });

    const prevButton = screen.getByRole("button", { name: /Previous/i });
    const nextButton = screen.getByRole("button", { name: /Next/i });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(prevButton);
    expect(mockNavigate).toHaveBeenCalledWith("/meeting/meeting-104");

    fireEvent.click(nextButton);
    expect(mockNavigate).toHaveBeenCalledWith("/meeting/meeting-106");
  });
});
