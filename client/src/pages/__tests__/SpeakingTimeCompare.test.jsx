import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import SpeakingTimeCompare from "../SpeakingTimeCompare.jsx";
import { speakingTimeApi } from "../../services";

// Mock speakingTimeApi
vi.mock("../../services", () => ({
  speakingTimeApi: {
    getOrgCompare: vi.fn(),
  },
}));

// Mock Navbar to avoid rendering complex nested subcomponents/contexts
vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Mock Navbar</div>,
}));

// Mock Recharts ResponsiveContainer to render content in tests
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("SpeakingTimeCompare Dashboard (#2038)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading spinner initially, then displays team stats and table", async () => {
    const mockData = {
      success: true,
      data: {
        meetingCount: 5,
        avgTalkRatio: 30.5,
        medianTalkRatio: 28.2,
        topSpeakers: [
          { identifier: "user-1", speakerName: "Alice", totalDuration: 600 },
        ],
        memberStats: [
          {
            identifier: "user-1",
            speakerName: "Alice",
            totalDuration: 600,
            averageTalkRatio: 30.5,
            meetingCount: 5,
          },
          {
            identifier: "user-2",
            speakerName: "Bob",
            totalDuration: 300,
            averageTalkRatio: 15.2,
            meetingCount: 3,
          },
        ],
      },
    };

    speakingTimeApi.getOrgCompare.mockResolvedValue({ data: mockData });

    render(
      <BrowserRouter>
        <SpeakingTimeCompare />
      </BrowserRouter>,
    );

    // Wait for compare data to be fetched and rendered
    await waitFor(() => {
      expect(
        screen.getByText("Team Speaking Time Comparison"),
      ).toBeInTheDocument();
      expect(screen.getAllByText("5")[0]).toBeInTheDocument(); // Meetings Analyzed count card
      expect(screen.getAllByText("30.5%")[0]).toBeInTheDocument(); // Avg Talk Ratio card
      expect(screen.getByText("28.2%")).toBeInTheDocument(); // Median Talk Ratio card
    });

    // Check table headers and content
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("10m 0s")).toBeInTheDocument(); // Alice's 600s formatted duration
  });

  it("renders empty state correctly when there is no meeting data", async () => {
    const mockEmptyData = {
      success: true,
      data: {
        meetingCount: 0,
        avgTalkRatio: 0,
        medianTalkRatio: 0,
        topSpeakers: [],
        memberStats: [],
      },
    };

    speakingTimeApi.getOrgCompare.mockResolvedValue({ data: mockEmptyData });

    render(
      <BrowserRouter>
        <SpeakingTimeCompare />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Insufficient Data")).toBeInTheDocument();
      expect(
        screen.getByText(/No meeting transcripts were found/i),
      ).toBeInTheDocument();
    });
  });

  it("renders error state when API call fails and allows retrying", async () => {
    speakingTimeApi.getOrgCompare.mockRejectedValueOnce(
      new Error("Network Error"),
    );

    render(
      <BrowserRouter>
        <SpeakingTimeCompare />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load team comparison"),
      ).toBeInTheDocument();
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });

    const retryBtn = screen.getByText("Retry");
    expect(retryBtn).toBeInTheDocument();
  });
});
