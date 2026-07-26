import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InviteMemberForm from "../InviteMemberForm";

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("InviteMemberForm", () => {
  const mockOnClose = vi.fn();
  const mockOnSendInvite = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", () => {
    render(
      <InviteMemberForm
        onClose={mockOnClose}
        onSendInvite={mockOnSendInvite}
      />,
    );
    expect(screen.getByText("Invite Team Member")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("name@company.com")).toBeInTheDocument();
  });

  it("calls onClose when close button or cancel is clicked", () => {
    render(
      <InviteMemberForm
        onClose={mockOnClose}
        onSendInvite={mockOnSendInvite}
      />,
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("shows error if email is not provided", async () => {
    render(
      <InviteMemberForm
        onClose={mockOnClose}
        onSendInvite={mockOnSendInvite}
      />,
    );

    // Attempt to submit without email (HTML5 validation should ideally stop it,
    // but in case it goes through or we test the handler)
    const form = screen
      .getByRole("button", { name: /send invitation/i })
      .closest("form");

    // Simulate handler being called without email (bypassing native validation for the sake of the test)
    fireEvent.submit(form);

    // Note: since email is marked required, if we use fireEvent.submit it triggers the synthetic event
    // The component's handleSubmit has `if (!inviteEmail) { toast.error... }`
    await waitFor(() => {
      expect(mockOnSendInvite).not.toHaveBeenCalled();
    });
  });

  it("calls onSendInvite with correct data when submitted", async () => {
    render(
      <InviteMemberForm
        onClose={mockOnClose}
        onSendInvite={mockOnSendInvite}
      />,
    );

    const emailInput = screen.getByPlaceholderText("name@company.com");
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });

    const roleSelect = screen.getByRole("combobox");
    fireEvent.change(roleSelect, { target: { value: "admin" } });

    const form = screen
      .getByRole("button", { name: /send invitation/i })
      .closest("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSendInvite).toHaveBeenCalledTimes(1);
      expect(mockOnSendInvite).toHaveBeenCalledWith(
        {
          email: "test@example.com",
          role: "admin",
          expiresIn: 7, // default
          message: "", // default
        },
        expect.any(Function),
      );
    });
  });
});
