import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingPlaybooks from "../MeetingPlaybooks.jsx";

vi.mock("../../api/meetingPlaybookApi", () => ({
  fetchPlaybooks: vi.fn(),
  generateAIPlaybook: vi.fn(),
  updatePlaybook: vi.fn(),
  deletePlaybook: vi.fn(),
  restorePlaybookVersion: vi.fn(),
  applyPlaybookToMeeting: vi.fn(),
}));

vi.mock("../../services/meetingApi", () => ({
  meetingApi: {
    getAllMeetings: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  fetchPlaybooks,
  updatePlaybook,
  restorePlaybookVersion,
  applyPlaybookToMeeting,
} from "../../api/meetingPlaybookApi";
import { meetingApi } from "../../services/meetingApi";
import { toast } from "react-toastify";

const samplePlaybooks = [
  {
    _id: "pb-1",
    name: "Design Sprint Playbook",
    description: "5-step design workshop",
    version: 2,
    steps: [
      {
        title: "Understand Problem",
        durationMinutes: 15,
        facilitatorPrompts: ["Define scope"],
        expectedOutputs: ["Scope doc"],
      },
      {
        title: "Ideate Solutions",
        durationMinutes: 20,
        facilitatorPrompts: ["Crazy 8s"],
        expectedOutputs: ["Sketches"],
      },
    ],
    versions: [
      {
        version: 1,
        name: "Design Sprint v1",
        description: "Initial draft",
        steps: [{ title: "Understand", durationMinutes: 10 }],
        savedAt: new Date().toISOString(),
      },
    ],
  },
];

describe("MeetingPlaybooks Page (#2448)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders playbook list with version tags and steps count", async () => {
    fetchPlaybooks.mockResolvedValue(samplePlaybooks);

    render(<MeetingPlaybooks />);

    expect(
      await screen.findByText("Design Sprint Playbook"),
    ).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText(/Steps: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Est. Duration: 35 mins/i)).toBeInTheDocument();
  });

  it("opens step editor modal and saves an updated version", async () => {
    fetchPlaybooks.mockResolvedValue(samplePlaybooks);
    updatePlaybook.mockResolvedValue({
      ...samplePlaybooks[0],
      version: 3,
      name: "Updated Design Sprint",
    });

    render(<MeetingPlaybooks />);

    await screen.findByText("Design Sprint Playbook");

    fireEvent.click(screen.getByRole("button", { name: /edit steps/i }));

    expect(screen.getByText("Edit Playbook & Steps")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Design Sprint Playbook"),
    ).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("Design Sprint Playbook");
    fireEvent.change(nameInput, { target: { value: "Updated Design Sprint" } });

    fireEvent.click(screen.getByRole("button", { name: /save new version/i }));

    await waitFor(() => {
      expect(updatePlaybook).toHaveBeenCalledWith(
        "pb-1",
        expect.objectContaining({
          name: "Updated Design Sprint",
        }),
      );
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("opens version history and allows restoring a prior version", async () => {
    fetchPlaybooks.mockResolvedValue(samplePlaybooks);
    restorePlaybookVersion.mockResolvedValue({
      ...samplePlaybooks[0],
      version: 3,
      name: "Design Sprint v1",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MeetingPlaybooks />);

    await screen.findByText("Design Sprint Playbook");

    fireEvent.click(screen.getByTitle("Version history"));

    expect(
      screen.getByText(/Version History: Design Sprint Playbook/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/v1 — Design Sprint v1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => {
      expect(restorePlaybookVersion).toHaveBeenCalledWith("pb-1", 1);
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("opens apply modal and applies playbook to a meeting", async () => {
    fetchPlaybooks.mockResolvedValue(samplePlaybooks);
    meetingApi.getAllMeetings.mockResolvedValue({
      data: {
        meetings: [
          {
            _id: "m-123",
            title: "Quarterly Roadmap Meeting",
            date: new Date().toISOString(),
          },
        ],
      },
    });
    applyPlaybookToMeeting.mockResolvedValue({ success: true });

    render(<MeetingPlaybooks />);

    await screen.findByText("Design Sprint Playbook");

    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(
      await screen.findByText("Apply Playbook to Meeting"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Quarterly Roadmap Meeting/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirm & apply/i }));

    await waitFor(() => {
      expect(applyPlaybookToMeeting).toHaveBeenCalledWith("pb-1", "m-123");
    });
    expect(toast.success).toHaveBeenCalled();
  });
});
