import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AbsenteeBriefingCard from "../AbsenteeBriefingCard";
import { absenteeCatchUpApi } from "../../../api/absenteeCatchUpApi";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../api/absenteeCatchUpApi", () => ({
  absenteeCatchUpApi: {
    getMeetingCatchUp: vi.fn(),
    generateMeetingCatchUp: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

describe("AbsenteeBriefingCard (#2423)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders prompt to generate briefing when none exists yet", async () => {
    absenteeCatchUpApi.getMeetingCatchUp.mockResolvedValue({
      success: true,
      catchUp: null,
    });

    render(<AbsenteeBriefingCard meetingId="m_123" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate Catch-Up Briefing" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /Missed this meeting\? Generate a personalized catch-up briefing/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders existing briefing overview, action items, decisions, and mentions", async () => {
    absenteeCatchUpApi.getMeetingCatchUp.mockResolvedValue({
      success: true,
      catchUp: {
        _id: "catchup_1",
        status: "pending",
        content: {
          overview: "Discussion centered on Q4 cloud migration timeline.",
          actionItems: ["Finalize terraform scripts by Friday"],
          decisions: ["Adopt AWS ECS Fargate"],
          mentions: ["Alice asked about security review"],
        },
      },
    });

    render(<AbsenteeBriefingCard meetingId="m_123" />);

    await waitFor(() => {
      expect(
        screen.getByText("Discussion centered on Q4 cloud migration timeline."),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Finalize terraform scripts by Friday"),
    ).toBeInTheDocument();
    expect(screen.getByText("Adopt AWS ECS Fargate")).toBeInTheDocument();
    expect(
      screen.getByText("Alice asked about security review"),
    ).toBeInTheDocument();
  });

  it("triggers generateMeetingCatchUp when generate button is clicked", async () => {
    absenteeCatchUpApi.getMeetingCatchUp.mockResolvedValue({
      success: true,
      catchUp: null,
    });
    absenteeCatchUpApi.generateMeetingCatchUp.mockResolvedValue({
      success: true,
      catchUp: {
        _id: "catchup_2",
        status: "pending",
        content: {
          overview: "Generated on-demand overview.",
          actionItems: [],
          decisions: [],
          mentions: [],
        },
      },
    });

    render(<AbsenteeBriefingCard meetingId="m_123" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate Catch-Up Briefing" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Generate Catch-Up Briefing" }),
    );

    await waitFor(() => {
      expect(absenteeCatchUpApi.generateMeetingCatchUp).toHaveBeenCalledWith(
        "m_123",
      );
      expect(
        screen.getByText("Generated on-demand overview."),
      ).toBeInTheDocument();
    });
  });
});
