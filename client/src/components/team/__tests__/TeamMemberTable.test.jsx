import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeamMemberTable from "../TeamMemberTable";

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("TeamMemberTable", () => {
  const mockMembers = [
    {
      _id: "1",
      name: "Alice Smith",
      email: "alice@example.com",
      role: "admin",
      isAccountVerified: true,
      createdAt: "2023-01-01T00:00:00.000Z",
    },
    {
      _id: "2",
      name: "Bob Jones",
      email: "bob@example.com",
      role: "member",
      isAccountVerified: false,
      createdAt: "2023-02-01T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no members provided", () => {
    render(<TeamMemberTable members={[]} searchQuery="" roleFilter="all" />);
    expect(screen.getByText("No members found")).toBeInTheDocument();
  });

  it("renders a list of members", () => {
    render(
      <TeamMemberTable members={mockMembers} searchQuery="" roleFilter="all" />,
    );

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("opens member details modal on click", () => {
    render(
      <TeamMemberTable members={mockMembers} searchQuery="" roleFilter="all" />,
    );

    // Click on Alice Smith's row (the h3 element or the row itself)
    const aliceRow = screen.getByText("Alice Smith").closest("div.group");
    fireEvent.click(aliceRow);

    // Modal should open
    // We expect the heading inside modal to appear, and we also see 'Close' button
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("closes member details modal when close button is clicked", () => {
    render(
      <TeamMemberTable members={mockMembers} searchQuery="" roleFilter="all" />,
    );

    const aliceRow = screen.getByText("Alice Smith").closest("div.group");
    fireEvent.click(aliceRow);

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    // Modal should close (close button should not be in document)
    expect(
      screen.queryByRole("button", { name: /close/i }),
    ).not.toBeInTheDocument();
  });
});
