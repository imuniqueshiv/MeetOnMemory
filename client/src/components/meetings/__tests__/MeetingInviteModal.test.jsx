import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingInviteModal from "../MeetingInviteModal.jsx";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services", () => ({
  meetingApi: {
    getInvite: vi
      .fn()
      .mockResolvedValue({
        data: { success: true, invite: { code: "abc123code", enabled: true } },
      }),
    regenerateInvite: vi.fn(),
    updateInvite: vi.fn(),
    sendEmailInvites: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

describe("MeetingInviteModal Email Validation (#1231)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents submitting empty email addresses and displays error message", async () => {
    render(
      <MeetingInviteModal
        isOpen={true}
        onClose={() => {}}
        meetingId="meeting-1"
        title="Sprint Meeting"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter participant email/i),
      ).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /add/i });
    fireEvent.click(addButton);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email address cannot be empty.",
    );
  });

  it("prevents malformed email addresses and displays error message", async () => {
    render(
      <MeetingInviteModal
        isOpen={true}
        onClose={() => {}}
        meetingId="meeting-1"
        title="Sprint Meeting"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter participant email/i),
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText(/enter participant email/i);
    fireEvent.change(emailInput, {
      target: { value: "invalid-email-address" },
    });

    const addButton = screen.getByRole("button", { name: /add/i });
    fireEvent.click(addButton);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter a valid email address.",
    );
  });

  it("prevents duplicate email entries", async () => {
    render(
      <MeetingInviteModal
        isOpen={true}
        onClose={() => {}}
        meetingId="meeting-1"
        title="Sprint Meeting"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter participant email/i),
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText(/enter participant email/i);
    const addButton = screen.getByRole("button", { name: /add/i });

    // Add valid email first time
    fireEvent.change(emailInput, {
      target: { value: "participant@example.com" },
    });
    fireEvent.click(addButton);

    expect(screen.getByText("participant@example.com")).toBeInTheDocument();

    // Attempt to add same email again
    fireEvent.change(emailInput, {
      target: { value: "participant@example.com" },
    });
    fireEvent.click(addButton);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This email has already been added.",
    );
  });

  it("adds valid email to participant list cleanly", async () => {
    render(
      <MeetingInviteModal
        isOpen={true}
        onClose={() => {}}
        meetingId="meeting-1"
        title="Sprint Meeting"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter participant email/i),
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText(/enter participant email/i);
    const addButton = screen.getByRole("button", { name: /add/i });

    fireEvent.change(emailInput, {
      target: { value: "valid.user@company.org" },
    });
    fireEvent.click(addButton);

    expect(screen.getByText("valid.user@company.org")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
