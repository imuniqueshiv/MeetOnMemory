import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DelegationPanel from "../DelegationPanel.jsx";
import api from "../../../services/apiClient.js";

vi.mock("../../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DelegationPanel Component (#2017)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders delegation form when no active delegation exists", async () => {
    api.get.mockResolvedValueOnce({
      data: { delegation: null },
    });

    const mockParticipants = [
      { user: { _id: "u1" }, name: "Bob", email: "bob@example.com" },
    ];

    render(
      <DelegationPanel meetingId="m_123" participants={mockParticipants} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Delegate Attendance Panel" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Delegate Attendance")).toBeInTheDocument();
      expect(screen.getByText("Full Delegation")).toBeInTheDocument();
      expect(screen.getByText("Action Items")).toBeInTheDocument();
    });
  });

  it("renders active delegation banner when delegation exists", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        delegation: {
          _id: "del_1",
          status: "pending",
          delegateeId: { name: "Alice" },
          scope: ["full"],
        },
      },
    });

    render(<DelegationPanel meetingId="m_123" participants={[]} />);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Active Meeting Delegation" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Active Delegation")).toBeInTheDocument();
      expect(screen.getByText(/Delegatee: Alice/)).toBeInTheDocument();
      expect(screen.getByText("Revoke")).toBeInTheDocument();
    });
  });
});
