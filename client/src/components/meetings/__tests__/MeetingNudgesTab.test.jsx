import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingNudgesTab from "../MeetingNudgesTab.jsx";
import apiClient from "../../../services/apiClient.js";

vi.mock("../../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
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

describe("MeetingNudgesTab Organizer Controls (#2062)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockMeetingId = "meet_123";

  it("renders scheduled smart nudges and accessible landmark region", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        success: true,
        enabled: true,
        nudges: [
          {
            id: "nudge-1",
            type: "Action Item Due",
            recipient: "All Assignees",
            message: "Review action items before sync",
            scheduledTime: "In 2 days",
            status: "scheduled",
          },
        ],
      },
    });

    render(<MeetingNudgesTab meetingId={mockMeetingId} isOrganizer={true} />);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Meeting Smart Nudges" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Review action items before sync"),
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId("generate-preview-button")).toBeInTheDocument();
    expect(screen.getByTestId("send-test-nudge-button")).toBeInTheDocument();
  });

  it("triggers preview generation and manual test send successfully", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        success: true,
        enabled: true,
        nudges: [],
      },
    });
    apiClient.post.mockResolvedValueOnce({
      data: { success: true },
    });

    render(<MeetingNudgesTab meetingId={mockMeetingId} isOrganizer={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("generate-preview-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("generate-preview-button"));

    await waitFor(() => {
      const cards = screen.getAllByTestId("nudge-card");
      expect(cards.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByTestId("send-test-nudge-button"));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/meetings/${mockMeetingId}/nudges/test-send`,
        expect.any(Object),
      );
    });
  });
});
