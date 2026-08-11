import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MeetingRepository from "../MeetingRepository";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services", () => ({
  meetingApi: {
    getAllMeetings: vi.fn(),
    deleteMeeting: vi.fn(),
    updateMeeting: vi.fn(),
  },
}));

vi.mock("../MeetingCard.jsx", () => ({
  default: ({ meeting }) => <div>{meeting.title}</div>,
}));

vi.mock("../MeetingSearch.jsx", () => ({
  default: () => <div data-testid="meeting-search" />,
}));

vi.mock("../MeetingFilters.jsx", () => ({
  default: () => <div data-testid="meeting-filters" />,
}));

vi.mock("../Pagination.jsx", () => ({
  default: () => null,
}));

vi.mock("../EmptyState.jsx", () => ({
  default: () => <div>Empty</div>,
}));

import { meetingApi } from "../../../services";

const cancelError = () => {
  const err = new Error("canceled");
  err.code = "ERR_CANCELED";
  return err;
};

describe("MeetingRepository race protection (#1131)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards an AbortSignal to getAllMeetings", async () => {
    meetingApi.getAllMeetings.mockResolvedValue({
      data: {
        success: true,
        meetings: [{ _id: "1", title: "Kickoff", createdAt: "2026-01-01" }],
      },
    });

    render(
      <MemoryRouter>
        <MeetingRepository />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Kickoff")).toBeInTheDocument();
    });

    expect(meetingApi.getAllMeetings).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("aborts an in-flight load so a late response cannot overwrite newer data", async () => {
    let resolveSlow;
    let slowSignal;

    meetingApi.getAllMeetings
      .mockImplementationOnce((_params, { signal } = {}) => {
        slowSignal = signal;
        return new Promise((resolve, reject) => {
          signal?.addEventListener("abort", () => reject(cancelError()));
          resolveSlow = (meetings) => {
            if (signal?.aborted) {
              reject(cancelError());
              return;
            }
            resolve({ data: { success: true, meetings } });
          };
        });
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          meetings: [
            { _id: "new", title: "Fresh Meeting", createdAt: "2026-02-01" },
          ],
        },
      });

    const { unmount } = render(
      <MemoryRouter>
        <MeetingRepository />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(meetingApi.getAllMeetings).toHaveBeenCalledTimes(1);
    });

    // Leaving the page aborts the outstanding request (#978 / #1131).
    unmount();
    expect(slowSignal?.aborted).toBe(true);

    render(
      <MemoryRouter>
        <MeetingRepository />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Fresh Meeting")).toBeInTheDocument();
    });

    await act(async () => {
      resolveSlow?.([
        { _id: "old", title: "Stale Meeting", createdAt: "2026-01-01" },
      ]);
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.queryByText("Stale Meeting")).not.toBeInTheDocument();
    expect(screen.getByText("Fresh Meeting")).toBeInTheDocument();
  });
});
