import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatSessionSidebar from "../ChatSessionSidebar.jsx";

const mockSessions = [
  {
    id: "session-1",
    title: "Project Strategy",
    updatedAt: new Date().toISOString(),
  },
];

describe("ChatSessionSidebar Non-nested Interactive Elements (#1229)", () => {
  it("renders session items without nested button HTML elements", () => {
    const { container } = render(
      <ChatSessionSidebar
        sessions={mockSessions}
        currentSessionId="session-1"
        onSelectSession={() => {}}
        onNewSession={() => {}}
        onDeleteSession={() => {}}
      />,
    );

    // Verify no button has a descendant button element
    const buttons = container.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn.querySelector("button")).toBeNull();
    });
  });

  it("selects session when item container is clicked", () => {
    const handleSelect = vi.fn();
    render(
      <ChatSessionSidebar
        sessions={mockSessions}
        currentSessionId=""
        onSelectSession={handleSelect}
        onNewSession={() => {}}
        onDeleteSession={() => {}}
      />,
    );

    const sessionItem = screen.getByRole("button", {
      name: /project strategy/i,
    });
    fireEvent.click(sessionItem);
    expect(handleSelect).toHaveBeenCalledWith("session-1");
  });

  it("triggers onDeleteSession when delete icon button is clicked without triggering parent click", () => {
    const handleDelete = vi.fn();
    const handleSelect = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ChatSessionSidebar
        sessions={mockSessions}
        currentSessionId=""
        onSelectSession={handleSelect}
        onNewSession={() => {}}
        onDeleteSession={handleDelete}
      />,
    );

    const deleteButton = screen.getByRole("button", {
      name: /delete conversation/i,
    });
    fireEvent.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith("session-1");
  });
});
