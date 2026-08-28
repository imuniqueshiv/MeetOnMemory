import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingRecorder from "../MeetingRecorder";

vi.mock("../../../services/apiClient", () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("MeetingRecorder Draft Persistence & Recovery (#1098)", () => {
  const LOCAL_STORAGE_KEY = "meetonmemory_meeting_recorder_draft";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders live recorder initial controls", () => {
    render(
      <MeetingRecorder title="Test Meeting" date="2026-08-04" tags={[]} />,
    );
    expect(screen.getByText(/Live Meeting Recorder/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Recording/i }),
    ).toBeInTheDocument();
  });

  it("prompts to restore saved local draft on mount if draft exists", () => {
    const savedDraft = {
      meetingId: "meeting-123",
      title: "Saved Draft Meeting",
      transcript: "This is a saved live transcript sample.",
      duration: 45,
      state: "stopped",
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedDraft));

    render(<MeetingRecorder title="New Meeting" date="2026-08-04" tags={[]} />);

    expect(
      screen.getByText(
        /An unsaved recording draft was restored from your previous session/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Restore/i }),
    ).toBeInTheDocument();
  });

  it("restores transcript and state when Restore draft is clicked", () => {
    const onMeetingCreated = vi.fn();
    const onTranscriptUpdate = vi.fn();
    const savedDraft = {
      meetingId: "meeting-123",
      title: "Saved Draft Meeting",
      transcript: "Restored draft transcript content.",
      duration: 120,
      state: "stopped",
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedDraft));

    render(
      <MeetingRecorder
        onMeetingCreated={onMeetingCreated}
        onTranscriptUpdate={onTranscriptUpdate}
      />,
    );

    const restoreBtn = screen.getByRole("button", { name: /Restore/i });
    fireEvent.click(restoreBtn);

    expect(onMeetingCreated).toHaveBeenCalledWith("meeting-123");
    expect(onTranscriptUpdate).toHaveBeenCalledWith(
      "Restored draft transcript content.",
      "Restored draft transcript content.",
    );
  });

  it("runs device setup before starting a new recording", () => {
    const onDeviceSetupNeeded = vi.fn();

    render(
      <MeetingRecorder
        title="Preflight Meeting"
        date="2026-08-25"
        tags={[]}
        onDeviceSetupNeeded={onDeviceSetupNeeded}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Start Recording/i }));

    expect(onDeviceSetupNeeded).toHaveBeenCalledTimes(1);
  });
});
