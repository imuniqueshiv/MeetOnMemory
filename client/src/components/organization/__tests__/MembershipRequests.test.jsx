import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MembershipRequests from "../MembershipRequests.jsx";
import { membershipRequestApi } from "../../../services";
import { toast } from "react-toastify";

vi.mock("../../../services", () => ({
  membershipRequestApi: {
    getOrganizationRequests: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
    bulkApproveRequests: vi.fn(),
    bulkRejectRequests: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const mockRequests = [
  {
    _id: "req-1",
    user: {
      _id: "user-1",
      name: "Alice Johnson",
      email: "alice@example.com",
      isAccountVerified: true,
    },
    message: "Excited to join the team!",
    status: "pending",
    createdAt: "2026-08-01T10:00:00.000Z",
  },
  {
    _id: "req-2",
    user: {
      _id: "user-2",
      name: "Bob Smith",
      email: "bob@example.com",
      isAccountVerified: false,
    },
    message: "Need access for project collaborate.",
    status: "pending",
    createdAt: "2026-08-02T11:00:00.000Z",
  },
  {
    _id: "req-3",
    user: {
      _id: "user-3",
      name: "Charlie Brown",
      email: "charlie@example.com",
      isAccountVerified: true,
    },
    status: "approved",
    createdAt: "2026-08-03T12:00:00.000Z",
    reviewedAt: "2026-08-03T14:00:00.000Z",
  },
];

describe("MembershipRequests Component - Multi-select and Bulk Actions (#2018)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    membershipRequestApi.getOrganizationRequests.mockResolvedValue({
      data: { success: true, requests: mockRequests },
    });
  });

  it('renders "No Organization Selected" when organizationId is missing', () => {
    render(<MembershipRequests organizationId={null} />);
    expect(screen.getByText("No Organization Selected")).toBeInTheDocument();
  });

  it("fetches and renders membership requests for the organization", async () => {
    render(<MembershipRequests organizationId="org-123" />);

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });

    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByText("Select All Pending (2)")).toBeInTheDocument();
  });

  it("allows individual selection of pending requests and displays bulk action bar", async () => {
    render(<MembershipRequests organizationId="org-123" />);

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("bulk-action-bar")).not.toBeInTheDocument();

    const aliceCheckbox = screen.getByLabelText(
      "Select request from Alice Johnson",
    );
    fireEvent.click(aliceCheckbox);

    expect(screen.getByTestId("bulk-action-bar")).toBeInTheDocument();
    expect(screen.getByText("1 request selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bulk approve 1 requests/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bulk reject 1 requests/i }),
    ).toBeInTheDocument();
  });

  it("toggles select-all for pending requests", async () => {
    render(<MembershipRequests organizationId="org-123" />);

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByLabelText(
      "Select all pending requests",
    );
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText("2 requests selected")).toBeInTheDocument();
    expect(screen.getByText("All Pending Selected")).toBeInTheDocument();

    // Deselect via bulk bar Deselect button
    const deselectBtn = screen.getByRole("button", {
      name: /clear selection/i,
    });
    fireEvent.click(deselectBtn);

    expect(screen.queryByTestId("bulk-action-bar")).not.toBeInTheDocument();
  });

  it("performs bulk approve successfully", async () => {
    membershipRequestApi.bulkApproveRequests.mockResolvedValue({
      data: {
        success: true,
        data: {
          results: [
            { requestId: "req-1", status: "approved" },
            { requestId: "req-2", status: "approved" },
          ],
          errors: [],
        },
      },
    });

    render(<MembershipRequests organizationId="org-123" />);

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Select all pending requests"));

    const bulkApproveBtn = screen.getByRole("button", {
      name: /bulk approve 2 requests/i,
    });
    fireEvent.click(bulkApproveBtn);

    // Modal should appear
    expect(
      screen.getByRole("heading", { name: /approve 2 membership requests/i }),
    ).toBeInTheDocument();

    const noteInput = screen.getByPlaceholderText(
      "Welcome message or onboarding note...",
    );
    fireEvent.change(noteInput, { target: { value: "Welcome to the team!" } });

    const confirmApproveBtn = screen.getByRole("button", {
      name: /confirm approve/i,
    });
    fireEvent.click(confirmApproveBtn);

    await waitFor(() => {
      expect(membershipRequestApi.bulkApproveRequests).toHaveBeenCalledWith(
        ["req-1", "req-2"],
        "Welcome to the team!",
      );
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Successfully approved 2 request(s)",
    );
  });

  it("performs bulk reject with rejection notes", async () => {
    membershipRequestApi.bulkRejectRequests.mockResolvedValue({
      data: {
        success: true,
        data: {
          results: [{ requestId: "req-1", status: "rejected" }],
          errors: [],
        },
      },
    });

    render(<MembershipRequests organizationId="org-123" />);

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Select request from Alice Johnson"));

    const bulkRejectBtn = screen.getByRole("button", {
      name: /bulk reject 1 requests/i,
    });
    fireEvent.click(bulkRejectBtn);

    expect(
      screen.getByRole("heading", { name: /reject 1 membership request/i }),
    ).toBeInTheDocument();

    const noteInput = screen.getByPlaceholderText(
      "Provide a reason for rejection...",
    );
    fireEvent.change(noteInput, {
      target: { value: "Positions currently full" },
    });

    const confirmRejectBtn = screen.getByRole("button", {
      name: /confirm reject/i,
    });
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(membershipRequestApi.bulkRejectRequests).toHaveBeenCalledWith(
        ["req-1"],
        "Positions currently full",
      );
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Successfully rejected 1 request(s)",
    );
  });

  it("handles partial failure in bulk action and reports error details", async () => {
    membershipRequestApi.bulkApproveRequests.mockResolvedValue({
      data: {
        success: true,
        data: {
          results: [{ requestId: "req-1", status: "approved" }],
          errors: [
            {
              requestId: "req-2",
              message: "User already active in organization.",
            },
          ],
        },
      },
    });

    render(<MembershipRequests organizationId="org-123" />);

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Select all pending requests"));
    fireEvent.click(
      screen.getByRole("button", { name: /bulk approve 2 requests/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm approve/i }));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "Approved 1 request(s), but 1 failed.",
      );
    });

    // Partial failure alert banner is displayed
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("User already active in organization."),
    ).toBeInTheDocument();

    // Failed request should remain selected
    expect(screen.getByText("1 request selected")).toBeInTheDocument();
  });

  it("still supports single item approve/reject", async () => {
    membershipRequestApi.approveRequest.mockResolvedValue({
      data: { success: true },
    });

    render(<MembershipRequests organizationId="org-123" />);

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });

    const approveAliceBtn = screen.getByRole("button", {
      name: /approve request from alice johnson/i,
    });
    fireEvent.click(approveAliceBtn);

    expect(
      screen.getByRole("heading", { name: "Review Membership Request" }),
    ).toBeInTheDocument();

    const approveSubmitBtn = screen.getByRole("button", { name: /^approve$/i });
    fireEvent.click(approveSubmitBtn);

    await waitFor(() => {
      expect(membershipRequestApi.approveRequest).toHaveBeenCalledWith(
        "req-1",
        { reviewNotes: "" },
      );
    });

    expect(toast.success).toHaveBeenCalledWith("Membership request approved");
  });
});
