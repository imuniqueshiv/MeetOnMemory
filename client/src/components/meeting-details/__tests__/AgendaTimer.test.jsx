import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import AppContent from "../../../context/AppContent";
import { meetingApi } from "../../../services";
import AgendaTimer from "../AgendaTimer.jsx";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("../../../services/apiClient.js", () => ({
  createClerkSocketOptions: vi.fn(async () => ({})),
}));

vi.mock("../../../services", () => ({
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

const ORG_A = "org-a";
const HOST = {
  _id: "host-1",
  name: "Ada",
  role: "member",
  organization: ORG_A,
};

const PENDING_ITEM = {
  _id: "item-1",
  text: "Review design",
  duration: 5,
  status: "pending",
  actualDuration: 0,
};

const makeMeeting = (items = [PENDING_ITEM], extras = {}) => ({
  _id: "meeting-123",
  uploadedBy: HOST._id,
  organization: ORG_A,
  agendaItems: items,
  ...extras,
});

const renderTimer = (userData, extraProps = {}, meeting = makeMeeting()) =>
  render(
    <AppContent.Provider
      value={{ userData, backendUrl: "http://localhost:5000" }}
    >
      <AgendaTimer meeting={meeting} {...extraProps} />
    </AppContent.Provider>,
  );

describe("AgendaTimer (#1985)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingApi.startAgendaItem.mockResolvedValue({
      data: {
        success: true,
        item: {
          ...PENDING_ITEM,
          status: "active",
          startedAt: new Date().toISOString(),
        },
      },
    });
    meetingApi.stopAgendaItem.mockResolvedValue({
      data: { success: true, item: { ...PENDING_ITEM, status: "completed" } },
    });
    meetingApi.skipAgendaItem.mockResolvedValue({
      data: { success: true, item: { ...PENDING_ITEM, status: "skipped" } },
    });
  });

  it("mounts with meeting context and planned remaining time for participants", () => {
    renderTimer({
      _id: "member-9",
      name: "Pat",
      role: "member",
      organization: ORG_A,
    });

    expect(screen.getByTestId("agenda-timer")).toHaveAttribute(
      "data-meeting-id",
      "meeting-123",
    );
    expect(screen.getByText("Review design")).toBeInTheDocument();
    expect(screen.getByText(/planned: 5 min/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start review design/i }),
    ).not.toBeInTheDocument();
  });

  it("lets the meeting host start, stop, and skip items", async () => {
    const { unmount } = renderTimer(HOST);

    fireEvent.click(
      screen.getByRole("button", { name: /start review design/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /skip review design/i }),
    );

    await waitFor(() => {
      expect(meetingApi.startAgendaItem).toHaveBeenCalledWith(
        "meeting-123",
        "item-1",
      );
      expect(meetingApi.skipAgendaItem).toHaveBeenCalledWith(
        "meeting-123",
        "item-1",
      );
    });

    unmount();

    const activeItem = {
      ...PENDING_ITEM,
      status: "active",
      startedAt: new Date().toISOString(),
    };
    renderTimer(HOST, {}, makeMeeting([activeItem]));

    fireEvent.click(
      screen.getByRole("button", { name: /stop review design/i }),
    );
    await waitFor(() => {
      expect(meetingApi.stopAgendaItem).toHaveBeenCalledWith(
        "meeting-123",
        "item-1",
      );
    });
  });

  it("lets a same-organization admin mutate the timer", async () => {
    renderTimer({
      _id: "admin-1",
      name: "Bo",
      role: "admin",
      organization: { _id: ORG_A },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /start review design/i }),
    );

    await waitFor(() => {
      expect(meetingApi.startAgendaItem).toHaveBeenCalledWith(
        "meeting-123",
        "item-1",
      );
    });
  });

  it("hides mutation controls in read-only mode", () => {
    renderTimer(HOST, { readOnly: true });

    expect(screen.getByTestId("agenda-timer")).toHaveAttribute(
      "data-readonly",
      "yes",
    );
    expect(
      screen.queryByRole("button", { name: /start review design/i }),
    ).not.toBeInTheDocument();
  });

  it("does not call the timer API when an unauthorized user cannot see controls", () => {
    renderTimer({
      _id: "outsider",
      role: "admin",
      organization: "org-b",
    });

    expect(
      screen.queryByRole("button", { name: /start|stop|skip/i }),
    ).not.toBeInTheDocument();
    expect(meetingApi.startAgendaItem).not.toHaveBeenCalled();
  });

  it("reuses an existing meeting socket instead of opening a second connection", () => {
    const socket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    const { unmount } = renderTimer(HOST, { socket });

    expect(io).not.toHaveBeenCalled();
    expect(socket.on).toHaveBeenCalledWith(
      "agenda_timer_updated",
      expect.any(Function),
    );

    unmount();
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.off).toHaveBeenCalledWith(
      "agenda_timer_updated",
      expect.any(Function),
    );
  });

  it("updates the current item when the existing socket emits a timer event", async () => {
    const listeners = {};
    const socket = {
      on: (event, handler) => {
        listeners[event] = handler;
      },
      off: vi.fn(),
    };

    renderTimer(
      {
        _id: "member-9",
        role: "member",
        organization: ORG_A,
      },
      { socket, compact: true },
    );

    expect(screen.getByText(/no agenda item running/i)).toBeInTheDocument();

    await act(async () => {
      listeners.agenda_timer_updated({
        action: "start",
        item: {
          ...PENDING_ITEM,
          status: "active",
          startedAt: new Date().toISOString(),
        },
      });
    });

    expect(screen.getByText("Review design")).toBeInTheDocument();
    expect(screen.getByText(/left/i)).toBeInTheDocument();
  });

  it("shows the overrun warning for an active item past its plan", () => {
    const overrunItem = {
      ...PENDING_ITEM,
      status: "active",
      duration: 1,
      startedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    };

    renderTimer(HOST, {}, makeMeeting([overrunItem]));

    expect(screen.getByText(/over by/i)).toBeInTheDocument();
  });

  it("shows remaining time on the compact live banner", () => {
    const activeItem = {
      ...PENDING_ITEM,
      status: "active",
      startedAt: new Date().toISOString(),
    };

    renderTimer(
      {
        _id: "member-9",
        role: "member",
        organization: ORG_A,
      },
      { compact: true },
      makeMeeting([activeItem]),
    );

    expect(screen.getByTestId("agenda-timer-banner")).toHaveAttribute(
      "data-meeting-id",
      "meeting-123",
    );
    expect(screen.getByText("Review design")).toBeInTheDocument();
    expect(screen.getByText(/left/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start review design/i }),
    ).not.toBeInTheDocument();
  });
});
