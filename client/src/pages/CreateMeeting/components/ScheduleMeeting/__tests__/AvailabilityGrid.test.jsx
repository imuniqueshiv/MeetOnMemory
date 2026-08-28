import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AvailabilityGrid from "../AvailabilityGrid.jsx";
import { calendarAvailabilityApi } from "../../../../../api/calendarAvailabilityApi.js";

vi.mock("../../../../../api/calendarAvailabilityApi.js", () => ({
  calendarAvailabilityApi: {
    getConnectionStatus: vi.fn(),
    getFreeBusy: vi.fn(),
    getConnectUrl: vi.fn(),
  },
}));

const participants = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

describe("ScheduleMeeting AvailabilityGrid (#2054)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarAvailabilityApi.getConnectionStatus.mockResolvedValue({
      success: true,
      integrations: [{ provider: "google", syncStatus: "connected" }],
    });
    calendarAvailabilityApi.getFreeBusy.mockResolvedValue({
      success: true,
      data: {
        google: {
          "alice@example.com": {
            busy: [
              {
                start: "2026-09-01T10:00:00.000Z",
                end: "2026-09-01T10:30:00.000Z",
              },
            ],
          },
          "bob@example.com": { busy: [] },
        },
        microsoft: [],
      },
    });
  });

  it("renders an explicit timezone and legend", async () => {
    render(
      <AvailabilityGrid
        participants={participants}
        selectedDate="2026-09-01"
        onSlotSelect={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/Calendar times shown in/i)).toBeInTheDocument(),
    );

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText(/Busy \/ conflict/i)).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows the conflicting participant on a busy slot", async () => {
    render(
      <AvailabilityGrid
        participants={participants}
        selectedDate="2026-09-01"
        onSlotSelect={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTitle(/Busy: Alice/i)).toBeInTheDocument(),
    );

    expect(screen.getByText("1 conflict")).toBeInTheDocument();
  });

  it("renders a connect CTA when no calendar is connected", async () => {
    calendarAvailabilityApi.getConnectionStatus.mockResolvedValue({
      success: true,
      integrations: [],
    });
    calendarAvailabilityApi.getFreeBusy.mockResolvedValue({
      success: true,
      data: { google: {}, microsoft: [] },
    });

    render(
      <AvailabilityGrid
        participants={participants}
        selectedDate="2026-09-01"
        onSlotSelect={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Connect a calendar to see real conflicts/i),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByRole("button", { name: /Connect Google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Connect Microsoft/i }),
    ).toBeInTheDocument();
  });

  it("shows an actionable error when free/busy fails", async () => {
    calendarAvailabilityApi.getFreeBusy.mockRejectedValue(
      new Error("Calendar service unavailable"),
    );

    render(
      <AvailabilityGrid
        participants={participants}
        selectedDate="2026-09-01"
        onSlotSelect={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText("Calendar service unavailable"),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByText(/Availability is unavailable/i),
    ).toBeInTheDocument();
  });

  it("selects a verified free slot", async () => {
    const onSlotSelect = vi.fn();

    render(
      <AvailabilityGrid
        participants={participants}
        selectedDate="2026-09-01"
        onSlotSelect={onSlotSelect}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTitle("Available at 11:00")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTitle("Available at 11:00"));
    expect(onSlotSelect).toHaveBeenCalledWith("11:00");
  });
});
