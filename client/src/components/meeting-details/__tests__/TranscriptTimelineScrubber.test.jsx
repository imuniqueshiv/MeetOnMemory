import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptTimelineScrubber from "../TranscriptTimelineScrubber.jsx";

vi.mock("../../../services/meetingTimelineApi", () => ({
  meetingTimelineApi: {
    getMeetingTimeline: vi.fn().mockResolvedValue({
      data: {
        success: true,
        timeline: [
          {
            type: "key_moment",
            startTime: 5,
            endTime: 8,
            data: { snippet: "Decision point" },
          },
        ],
      },
    }),
  },
}));

vi.mock("../../../hooks/useTimelineSync", () => ({
  useTimelineSync: () => ({
    currentTime: 0,
    duration: 60,
    isPlaying: false,
    playerRef: { current: null },
    seekTo: vi.fn(),
    togglePlayPause: vi.fn(),
    handleTimeUpdate: vi.fn(),
    handleDurationChange: vi.fn(),
    setIsPlaying: vi.fn(),
  }),
}));

vi.mock("../TimelinePlayer", () => ({
  default: ({ meeting }) => (
    <div
      data-testid="timeline-player"
      data-audio={meeting?.audioFilePath || ""}
    >
      Player
    </div>
  ),
}));

describe("TranscriptTimelineScrubber (#2252)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows graceful empty state when media is missing", () => {
    render(
      <TranscriptTimelineScrubber
        meetingId="m1"
        meeting={{ title: "No media" }}
        transcript={{ segments: [{ startTime: 0, endTime: 5, speaker: "A" }] }}
      />,
    );

    expect(screen.getByTestId("transcript-scrubber-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-player")).not.toBeInTheDocument();
  });

  it("renders scrubber and player when media exists", async () => {
    render(
      <TranscriptTimelineScrubber
        meetingId="m1"
        meeting={{ fileUrl: "recordings/meet.mp3" }}
        transcript={{
          duration: 60,
          segments: [
            { startTime: 0, endTime: 10, speaker: "Alice", text: "Hi" },
            { startTime: 10, endTime: 20, speaker: "Bob", text: "Hello" },
          ],
        }}
      />,
    );

    expect(
      await screen.findByTestId("transcript-timeline-scrubber"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("timeline-player")).toHaveAttribute(
      "data-audio",
      "recordings/meet.mp3",
    );
    expect(screen.getByText("Speaker Timeline")).toBeInTheDocument();
  });

  it("uses transcript audioFilePath when meeting has no media", async () => {
    render(
      <TranscriptTimelineScrubber
        meetingId="m1"
        meeting={{ title: "Sync" }}
        transcript={{
          audioFilePath: "uploads/b.wav",
          segments: [{ startTime: 0, endTime: 4, speaker: "A", text: "Hi" }],
        }}
      />,
    );

    expect(
      await screen.findByTestId("transcript-timeline-scrubber"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("timeline-player")).toHaveAttribute(
      "data-audio",
      "uploads/b.wav",
    );
  });
});
