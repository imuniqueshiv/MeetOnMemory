/* global jest, describe, beforeEach, afterEach, it, expect */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ParticipantContributions from "../ParticipantContributions";
import {
  useMeetingContributions,
  useCalculateMeetingContributions,
} from "../../../hooks/useParticipantContributions";
import "@testing-library/jest-dom";

// Mock the hooks
jest.mock("../../../hooks/useParticipantContributions");

// Mock recharts to avoid rendering SVG issues in jest
jest.mock("recharts", () => {
  const OriginalRecharts = jest.requireActual("recharts");
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }) => (
      <div className="recharts-responsive-container">{children}</div>
    ),
    RadarChart: () => <div data-testid="radar-chart" />,
  };
});

describe("ParticipantContributions", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useCalculateMeetingContributions.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ParticipantContributions meetingId="test-meeting-id" />
      </QueryClientProvider>,
    );
  };

  it("renders loading state initially", () => {
    useMeetingContributions.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });
    renderComponent();
    expect(screen.getByText("Loading contributions...")).toBeInTheDocument();
  });

  it("renders empty state when no contributions exist", () => {
    useMeetingContributions.mockReturnValue({
      data: { contributions: [], equityScore: 0 },
      isLoading: false,
      isError: false,
    });
    renderComponent();
    expect(
      screen.getByText(/No contribution data available yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Calculate Now/i }),
    ).toBeInTheDocument();
  });

  it("renders radar chart and rankings when data is present", () => {
    useMeetingContributions.mockReturnValue({
      data: {
        contributions: [
          {
            participantId: "user1",
            participantName: "Alice",
            dimensions: {
              verbal: 80,
              task: 50,
              decisional: 20,
              collaborative: 60,
            },
            overallImpact: 52,
            coachingTips: ["Try to focus your input on actionable outcomes."],
          },
        ],
        equityScore: 85,
      },
      isLoading: false,
      isError: false,
    });

    renderComponent();

    expect(
      screen.getByText("Participant Contribution Profile"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("radar-chart")).toBeInTheDocument();
    expect(screen.getByText("Meeting Equity Score")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/Try to focus your input/i)).toBeInTheDocument();
  });

  it("calls calculate mutation on button click", () => {
    const mockMutate = jest.fn();
    useCalculateMeetingContributions.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
    useMeetingContributions.mockReturnValue({
      data: { contributions: [], equityScore: 0 },
      isLoading: false,
      isError: false,
    });

    renderComponent();

    const calculateBtn = screen.getByRole("button", { name: /Calculate Now/i });
    fireEvent.click(calculateBtn);

    expect(mockMutate).toHaveBeenCalledWith("test-meeting-id");
  });
});
