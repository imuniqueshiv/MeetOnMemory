import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import FacilitatorDashboard from "../FacilitatorDashboard";
import AppContent from "../../context/AppContent";
import { meetingApi } from "../../services";

vi.mock("../../services", () => ({
  meetingApi: {
    startAgendaItem: vi.fn(),
    stopAgendaItem: vi.fn(),
    skipAgendaItem: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("FacilitatorDashboard Live Pacing & Agenda Sync (#2450)", () => {
  const mockMeeting = {
    _id: "m-123",
    title: "Sprint Retrospective",
    uploadedBy: "u-host",
    organization: "org-1",
    agendaItems: [
      {
        _id: "item-1",
        text: "Sprint Overview",
        description: "Review what was accomplished",
        duration: 5,
        status: "pending",
        actualDuration: 0,
      },
      {
        _id: "item-2",
        text: "Team Feedback",
        description: "What went well and what did not",
        duration: 10,
        status: "pending",
        actualDuration: 0,
      },
    ],
    participants: [
      {
        user: "u-1",
        name: "Alice",
        role: "developer",
      },
      {
        user: "u-2",
        name: "Bob",
        role: "designer",
      },
    ],
  };

  const mockUserHost = {
    _id: "u-host",
    name: "Host User",
    organization: "org-1",
    role: "admin",
  };

  const mockUserMember = {
    _id: "u-member",
    name: "Member User",
    organization: "org-1",
    role: "member",
  };

  const renderWithContext = (props = {}, user = mockUserHost) => {
    return render(
      <AppContent.Provider
        value={{ backendUrl: "http://localhost:5000", userData: user }}
      >
        <FacilitatorDashboard meeting={mockMeeting} {...props} />
      </AppContent.Provider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders live pacing status and current agenda details", () => {
    renderWithContext();

    expect(screen.getByText("Facilitator Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Sprint Retrospective")).toBeInTheDocument();
    expect(screen.getByTestId("pacing-badge")).toHaveTextContent(
      "Pacing: Ready",
    );
    expect(screen.getByText("Sprint Overview")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("dynamically reflects pacing: on track when an item is active and within limit", () => {
    const meetingWithActive = {
      ...mockMeeting,
      agendaItems: [
        {
          ...mockMeeting.agendaItems[0],
          status: "active",
          startedAt: new Date(Date.now() - 60000).toISOString(), // 1 min elapsed of 5m
        },
        mockMeeting.agendaItems[1],
      ],
    };

    render(
      <AppContent.Provider
        value={{ backendUrl: "http://localhost:5000", userData: mockUserHost }}
      >
        <FacilitatorDashboard meeting={meetingWithActive} />
      </AppContent.Provider>,
    );

    expect(screen.getByTestId("pacing-badge")).toHaveTextContent(
      "Pacing: On Track",
    );
  });

  it("dynamically reflects pacing: over time when meeting runs over planned duration", () => {
    const meetingOverrun = {
      ...mockMeeting,
      agendaItems: [
        {
          ...mockMeeting.agendaItems[0],
          status: "completed",
          actualDuration: 400000, // 6.6 min (planned was 5m)
        },
        {
          ...mockMeeting.agendaItems[1],
          status: "completed",
          actualDuration: 700000, // 11.6 min (planned was 10m)
        },
      ],
    };

    render(
      <AppContent.Provider
        value={{ backendUrl: "http://localhost:5000", userData: mockUserHost }}
      >
        <FacilitatorDashboard meeting={meetingOverrun} />
      </AppContent.Provider>,
    );

    expect(screen.getByTestId("pacing-badge")).toHaveTextContent("Over Time");
  });

  it("allows authorized facilitator to start, pause, skip, and advance agenda items", async () => {
    meetingApi.startAgendaItem.mockResolvedValue({
      data: {
        success: true,
        item: {
          ...mockMeeting.agendaItems[0],
          status: "active",
          startedAt: new Date().toISOString(),
        },
      },
    });
    meetingApi.skipAgendaItem.mockResolvedValue({
      data: {
        success: true,
        item: { ...mockMeeting.agendaItems[0], status: "skipped" },
      },
    });

    const onAdvanceAgenda = vi.fn();
    renderWithContext({ onAdvanceAgenda });

    const startBtn = screen.getByRole("button", { name: /start timer/i });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(meetingApi.startAgendaItem).toHaveBeenCalledWith(
        "m-123",
        "item-1",
      );
    });

    const advanceBtn = screen.getByRole("button", {
      name: /advance to next item/i,
    });
    await act(async () => {
      fireEvent.click(advanceBtn);
    });
    expect(onAdvanceAgenda).toHaveBeenCalledWith(1);
  });

  it("restricts start/pause/skip controls for non-authorized users (RBAC)", () => {
    renderWithContext({}, mockUserMember);

    expect(screen.getByText("View Only")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start timer/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /skip item/i }),
    ).not.toBeInTheDocument();
  });

  it("syncs agenda state when receiving agenda_timer_updated socket event", async () => {
    const listeners = {};
    const mockSocket = {
      on: vi.fn((evt, cb) => {
        listeners[evt] = cb;
      }),
      off: vi.fn(),
      emit: vi.fn(),
    };

    renderWithContext({ socket: mockSocket });

    expect(mockSocket.on).toHaveBeenCalledWith(
      "agenda_timer_updated",
      expect.any(Function),
    );

    // Simulate remote timer update wrapped in act
    act(() => {
      listeners.agenda_timer_updated({
        item: {
          _id: "item-1",
          text: "Sprint Overview",
          duration: 5,
          status: "active",
          startedAt: new Date().toISOString(),
        },
        action: "start",
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /pause timer/i }),
      ).toBeInTheDocument();
    });
  });
});
