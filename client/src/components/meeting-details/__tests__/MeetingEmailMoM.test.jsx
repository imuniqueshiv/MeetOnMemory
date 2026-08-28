import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import MeetingActions from "../MeetingActions";
import { meetingApi } from "../../../services/meetingApi.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../../services/meetingApi.js", () => ({
  meetingApi: {
    sendMeetingDigest: vi.fn(),
    previewMeetingDigest: vi.fn(),
  },
}));

vi.mock("../../../hooks/useExport.js", () => ({
  default: () => ({
    exportMeeting: vi.fn(),
    isExporting: false,
  }),
}));

vi.mock("../../../hooks/usePolling.js", () => ({
  usePolling: () => ({
    startPolling: vi.fn(),
  }),
}));

describe("MeetingActions Email MoM Workflow (#2254)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockMeeting = {
    _id: "m_123",
    title: "Q3 Engineering Sync",
    summary: "Discussion on scaling database cluster.",
    participants: [
      { name: "Alice Smith", email: "alice@example.com" },
      { name: "Bob Jones", email: "bob@example.com" },
    ],
  };

  it("renders Email MoM action button and opens email distribution modal", async () => {
    render(
      <BrowserRouter>
        <MeetingActions
          meeting={mockMeeting}
          onDelete={vi.fn()}
          onRename={vi.fn()}
        />
      </BrowserRouter>,
    );

    const emailButton = screen.getByRole("button", {
      name: "Email MoM to participants",
    });
    expect(emailButton).toBeInTheDocument();

    fireEvent.click(emailButton);

    expect(
      screen.getByRole("dialog", { name: "Email MoM to Participants Modal" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Q3 Engineering Sync")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("loads and renders email preview HTML when preview toggle is clicked", async () => {
    meetingApi.previewMeetingDigest.mockResolvedValue({
      data: "<div><h3>Preview MoM</h3><p>Detailed notes</p></div>",
    });

    render(
      <BrowserRouter>
        <MeetingActions
          meeting={mockMeeting}
          onDelete={vi.fn()}
          onRename={vi.fn()}
        />
      </BrowserRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Email MoM to participants" }),
    );

    const previewToggle = screen.getByText("Preview Digest Email HTML");
    fireEvent.click(previewToggle);

    await waitFor(() => {
      expect(meetingApi.previewMeetingDigest).toHaveBeenCalledWith("m_123");
      expect(screen.getByText("Detailed notes")).toBeInTheDocument();
    });
  });

  it("triggers sendMeetingDigest API and closes modal on success", async () => {
    meetingApi.sendMeetingDigest.mockResolvedValue({
      data: { success: true, recipientsSentTo: 2 },
    });

    render(
      <BrowserRouter>
        <MeetingActions
          meeting={mockMeeting}
          onDelete={vi.fn()}
          onRename={vi.fn()}
        />
      </BrowserRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Email MoM to participants" }),
    );

    const sendButton = screen.getByTestId("confirm-send-email-mom-button");
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(meetingApi.sendMeetingDigest).toHaveBeenCalledWith("m_123");
      expect(
        screen.queryByRole("dialog", {
          name: "Email MoM to Participants Modal",
        }),
      ).not.toBeInTheDocument();
    });
  });
});
