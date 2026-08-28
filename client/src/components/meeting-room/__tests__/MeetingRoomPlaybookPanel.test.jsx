import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MeetingRoomPlaybookPanel from "../MeetingRoomPlaybookPanel.jsx";

vi.mock("../../../api/meetingPlaybookApi.js", () => ({
  fetchPlaybooks: vi.fn(),
  fetchPlaybookById: vi.fn(),
}));

vi.mock("../../../hooks/useMeetingPlaybook.js", () => ({
  useMeetingPlaybook: vi.fn(),
}));

import {
  fetchPlaybooks,
  fetchPlaybookById,
} from "../../../api/meetingPlaybookApi.js";
import { useMeetingPlaybook } from "../../../hooks/useMeetingPlaybook.js";

const samplePlaybook = {
  _id: "pb-1",
  name: "Sprint Retro",
  steps: [
    {
      title: "Set the stage",
      durationMinutes: 5,
      facilitatorPrompts: ["Welcome the team"],
      expectedOutputs: ["Shared context"],
    },
  ],
};

describe("MeetingRoomPlaybookPanel (#2447)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMeetingPlaybook.mockReturnValue({
      playbookState: {
        isActive: false,
        playbookId: null,
        currentStepIndex: 0,
        startTime: null,
        timerWarning: false,
      },
      startPlaybook: vi.fn(),
      advanceStep: vi.fn(),
      emitTimerWarning: vi.fn(),
    });
  });

  it("shows empty CTA when no playbooks exist", async () => {
    fetchPlaybooks.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <MeetingRoomPlaybookPanel
          socket={{}}
          meetingId="meeting-1"
          isFacilitator
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByTestId("meeting-room-playbook-empty"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /assign a playbook/i }),
    ).toHaveAttribute("href", "/playbooks");
  });

  it("loads playbooks and lets facilitators start guidance", async () => {
    fetchPlaybooks.mockResolvedValue([samplePlaybook]);
    const startPlaybook = vi.fn();
    useMeetingPlaybook.mockReturnValue({
      playbookState: {
        isActive: false,
        playbookId: null,
        currentStepIndex: 0,
        startTime: null,
        timerWarning: false,
      },
      startPlaybook,
      advanceStep: vi.fn(),
      emitTimerWarning: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MeetingRoomPlaybookPanel
          socket={{}}
          meetingId="meeting-1"
          isFacilitator
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByTestId("meeting-room-playbook-setup"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /start playbook guidance/i }),
    );
    expect(startPlaybook).toHaveBeenCalledWith("pb-1");
  });

  it("renders active playbook steps from fetched playbook", async () => {
    fetchPlaybooks.mockResolvedValue([samplePlaybook]);
    fetchPlaybookById.mockResolvedValue(samplePlaybook);
    useMeetingPlaybook.mockReturnValue({
      playbookState: {
        isActive: true,
        playbookId: "pb-1",
        currentStepIndex: 0,
        startTime: Date.now(),
        timerWarning: false,
      },
      startPlaybook: vi.fn(),
      advanceStep: vi.fn(),
      emitTimerWarning: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MeetingRoomPlaybookPanel
          socket={{}}
          meetingId="meeting-1"
          isFacilitator
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("playbook-guidance-panel")).toBeInTheDocument();
    });
    expect(screen.getByText(/Step 1: Set the stage/i)).toBeInTheDocument();
    expect(fetchPlaybookById).toHaveBeenCalledWith("pb-1");
  });
});
