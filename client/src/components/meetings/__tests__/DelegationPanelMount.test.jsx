// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DelegationPanel from "../DelegationPanel.jsx";
import MyDelegations from "../../../pages/MyDelegations.jsx";
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

describe("DelegationPanel & ConfirmModal Flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DelegationPanel Revoke with ConfirmModal", () => {
    it("opens ConfirmModal on Revoke click and posts to /api/delegations/:id/revoke when confirmed", async () => {
      const activeDelegation = {
        _id: "del-100",
        status: "approved",
        delegateeId: { name: "Bob Delegatee" },
        scope: ["full"],
      };

      api.get.mockResolvedValueOnce({
        data: { delegation: activeDelegation },
      });
      api.post.mockResolvedValueOnce({
        data: { delegation: { ...activeDelegation, status: "revoked" } },
      });

      render(<DelegationPanel meetingId="m-999" participants={[]} />);

      await waitFor(() => {
        expect(screen.getByText("Active Delegation")).toBeInTheDocument();
      });

      const revokeButton = screen.getByRole("button", { name: /revoke/i });
      fireEvent.click(revokeButton);

      // Confirm modal title should be visible
      expect(screen.getByText("Revoke Delegation")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Are you sure you want to revoke this delegation request?",
        ),
      ).toBeInTheDocument();

      const revokeButtons = screen.getAllByRole("button", { name: "Revoke" });
      const confirmButton = revokeButtons[revokeButtons.length - 1];
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          "/api/delegations/del-100/revoke",
        );
      });
    });
  });

  describe("MyDelegations Approve/Reject/Revoke with ConfirmModal", () => {
    it("opens ConfirmModal on Approve click and posts to /api/delegations/:id/approve when confirmed", async () => {
      const pendingDelegation = {
        _id: "del-200",
        status: "pending",
        meetingId: { title: "Strategic Alignment" },
        delegatorId: { name: "Alice Host" },
        scope: ["voting"],
      };

      api.get.mockResolvedValueOnce({
        data: {
          delegatedByMe: [],
          delegatedToMe: [pendingDelegation],
        },
      });
      api.post.mockResolvedValueOnce({ data: { success: true } });

      render(<MyDelegations />);

      await waitFor(() => {
        expect(screen.getByText("Delegated To Me")).toBeInTheDocument();
      });

      // Switch tab to Delegated To Me
      fireEvent.click(screen.getByText("Delegated To Me"));

      await waitFor(() => {
        expect(screen.getByTitle("Accept")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Accept"));

      // Confirm modal should appear
      expect(
        screen.getByText("Approve Delegation Request"),
      ).toBeInTheDocument();

      // Click Approve in ConfirmModal
      const approveModalButton = screen.getByRole("button", {
        name: "Approve",
      });
      fireEvent.click(approveModalButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          "/api/delegations/del-200/approve",
        );
      });
    });
  });
});
