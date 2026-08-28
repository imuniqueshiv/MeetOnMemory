import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingEffectiveness from "../MeetingEffectiveness.jsx";
import { useEffectivenessScore } from "../../hooks/useEffectivenessScore.js";

vi.mock("../../hooks/useEffectivenessScore.js", () => ({
  useEffectivenessScore: vi.fn(),
}));

// Mock recharts so test doesn't fail on SVG DOM size calculations
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  RadarChart: ({ children }) => <div data-testid="radar-chart">{children}</div>,
  Radar: () => <div />,
  PolarGrid: () => <div />,
  PolarAngleAxis: () => <div />,
  PolarRadiusAxis: () => <div />,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

describe("MeetingEffectiveness Page Component", () => {
  const mockFetchMeetingScore = vi.fn();
  const mockFetchOrgTrends = vi.fn();
  const mockFetchSeriesTrends = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useEffectivenessScore.mockReturnValue({
      loading: false,
      error: null,
      meetingScore: null,
      orgTrends: [],
      seriesTrends: [],
      fetchMeetingScore: mockFetchMeetingScore,
      fetchOrgTrends: mockFetchOrgTrends,
      fetchSeriesTrends: mockFetchSeriesTrends,
      clearError: mockClearError,
    });
  });

  it("renders header and no meeting selected empty state when no meetingId is present", () => {
    render(
      <MemoryRouter initialEntries={["/effectiveness"]}>
        <Routes>
          <Route path="/effectiveness" element={<MeetingEffectiveness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Meeting Effectiveness Scorecard"),
    ).toBeInTheDocument();
    expect(screen.getByText("No Meeting Selected")).toBeInTheDocument();
  });

  it("renders error state when error is returned by hook", () => {
    useEffectivenessScore.mockReturnValue({
      loading: false,
      error: "Failed to load score data",
      meetingScore: null,
      orgTrends: [],
      seriesTrends: [],
      fetchMeetingScore: mockFetchMeetingScore,
      fetchOrgTrends: mockFetchOrgTrends,
      fetchSeriesTrends: mockFetchSeriesTrends,
      clearError: mockClearError,
    });

    render(
      <MemoryRouter initialEntries={["/effectiveness/m-123"]}>
        <Routes>
          <Route
            path="/effectiveness/:meetingId"
            element={<MeetingEffectiveness />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Unable to Load Scorecard")).toBeInTheDocument();
    expect(screen.getByText("Failed to load score data")).toBeInTheDocument();

    const retryBtn = screen.getByText("Retry");
    fireEvent.click(retryBtn);
    expect(mockClearError).toHaveBeenCalled();
  });

  it("renders meeting scorecard dimensions when data is loaded", () => {
    useEffectivenessScore.mockReturnValue({
      loading: false,
      error: null,
      meetingScore: {
        overallScore: 88,
        dimensions: {
          goalCompletionRate: 92,
          actionItemFollowThrough: 85,
          participantSatisfaction: 80,
          decisionClarity: 95,
          timeEfficiency: 90,
        },
      },
      orgTrends: [],
      seriesTrends: [],
      fetchMeetingScore: mockFetchMeetingScore,
      fetchOrgTrends: mockFetchOrgTrends,
      fetchSeriesTrends: mockFetchSeriesTrends,
      clearError: mockClearError,
    });

    render(
      <MemoryRouter initialEntries={["/effectiveness/m-123"]}>
        <Routes>
          <Route
            path="/effectiveness/:meetingId"
            element={<MeetingEffectiveness />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByTestId("radar-chart")).toBeInTheDocument();
  });
});
