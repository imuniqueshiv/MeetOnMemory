// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MentionPicker from "../MentionPicker.jsx";

describe("MentionPicker Component", () => {
  const mockMembers = [
    {
      id: "m-1",
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "admin",
    },
    { id: "m-2", name: "Bob Smith", email: "bob@example.com", role: "member" },
  ];

  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <MentionPicker
        isOpen={false}
        query=""
        members={mockMembers}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders member options filtered by query", () => {
    render(
      <MentionPicker
        isOpen={true}
        query="Alice"
        members={mockMembers}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();
  });

  it("triggers onSelect when member option is clicked", () => {
    render(
      <MentionPicker
        isOpen={true}
        query=""
        members={mockMembers}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />,
    );

    const memberOption = screen.getByText("Alice Johnson");
    fireEvent.click(memberOption);

    expect(mockOnSelect).toHaveBeenCalledWith(mockMembers[0]);
  });
});
