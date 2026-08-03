/**
 * Issue #1069 — the client half of the broken poll delete.
 *
 * `deletePoll(poll._id)` and `closePoll(poll._id)` were fired as bare promises
 * from their onClick handlers. While the server was answering 500 for every
 * delete, the button therefore did nothing observable: the poll stayed on
 * screen, no error surfaced, and the rejection went to an unhandled promise.
 * Every other action in this component reports failures through the same
 * try/catch + alert path; these two now do as well.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("../../../services/apiClient.js", () => ({
  createClerkSocketOptions: vi.fn(async () => ({})),
}));

vi.mock("../../../api/pollApi", () => ({
  createPoll: vi.fn(),
  getPollsByMeeting: vi.fn(),
  castVote: vi.fn(),
  closePoll: vi.fn(),
  deletePoll: vi.fn(),
}));

import PollSection from "../PollSection";
import AppContent from "../../../context/AppContent";
import { closePoll, deletePoll, getPollsByMeeting } from "../../../api/pollApi";

const ADMIN = {
  _id: "user-admin",
  name: "Ada",
  role: "admin",
};

const POLL = {
  _id: "poll-1",
  question: "Ship on Friday?",
  createdBy: { _id: "user-creator", name: "Bo" },
  createdAt: "2026-08-01T10:00:00.000Z",
  isAnonymous: false,
  isClosed: false,
  pollType: "single",
  options: [
    { _id: "opt-1", text: "Yes", votes: [] },
    { _id: "opt-2", text: "No", votes: [] },
  ],
};

const renderPollSection = () =>
  render(
    <AppContent.Provider
      value={{ userData: ADMIN, backendUrl: "http://localhost:4000" }}
    >
      <PollSection meetingId="meeting-1" />
    </AppContent.Provider>,
  );

describe("PollSection poll deletion (#1069)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPollsByMeeting.mockResolvedValue([POLL]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks for confirmation before deleting", async () => {
    window.confirm.mockReturnValue(false);
    renderPollSection();

    const button = await screen.findByRole("button", { name: /delete/i });
    fireEvent.click(button);

    expect(window.confirm).toHaveBeenCalledWith("Delete this poll?");
    expect(deletePoll).not.toHaveBeenCalled();
  });

  it("calls the API with the poll id once confirmed", async () => {
    deletePoll.mockResolvedValue({ message: "Poll deleted successfully" });
    renderPollSection();

    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));

    await waitFor(() => expect(deletePoll).toHaveBeenCalledWith("poll-1"));
  });

  it("removes the poll from the list on success without waiting for the socket", async () => {
    deletePoll.mockResolvedValue({ message: "Poll deleted successfully" });
    renderPollSection();

    expect(await screen.findByText("Ship on Friday?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() =>
      expect(screen.queryByText("Ship on Friday?")).toBeNull(),
    );
  });

  it("surfaces the server message when the delete fails", async () => {
    deletePoll.mockRejectedValue({
      response: { data: { message: "Forbidden: Only creator or admin" } },
    });
    renderPollSection();

    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        "Forbidden: Only creator or admin",
      ),
    );
  });

  it("falls back to a generic message when the server sends none", async () => {
    deletePoll.mockRejectedValue(new Error("Network Error"));
    renderPollSection();

    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Error deleting poll"),
    );
  });

  it("keeps the poll on screen when the delete fails", async () => {
    deletePoll.mockRejectedValue(new Error("Server Error"));
    renderPollSection();

    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));

    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(screen.getByText("Ship on Friday?")).toBeTruthy();
  });

  it("reports a failed close instead of swallowing it", async () => {
    closePoll.mockRejectedValue({
      response: { data: { message: "Poll already closed" } },
    });
    renderPollSection();

    fireEvent.click(await screen.findByRole("button", { name: /close poll/i }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Poll already closed"),
    );
  });
});
