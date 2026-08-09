import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MeetingActions from "../MeetingActions";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../hooks/useExport.js", () => ({
  default: () => ({ exportMeeting: vi.fn(), isExporting: false }),
}));

describe("Meeting Delete & Rename Modals - Accessibility & Dark Mode (#838)", () => {
  const mockMeeting = {
    _id: "m123",
    title: "Project Sync",
    transcript: "Hello world",
  };

  const mockOnDelete = vi.fn();
  const mockOnRename = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Delete Modal with proper dialog role and ARIA labels", () => {
    render(
      <MemoryRouter>
        <MeetingActions
          meeting={mockMeeting}
          onDelete={mockOnDelete}
          onRename={mockOnRename}
        />
      </MemoryRouter>,
    );

    // Open Delete Modal
    const deleteBtn = screen.getByText("Delete Meeting");
    fireEvent.click(deleteBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-modal-title");
  });

  it("closes Delete Modal on Escape key press and backdrop click", () => {
    render(
      <MemoryRouter>
        <MeetingActions
          meeting={mockMeeting}
          onDelete={mockOnDelete}
          onRename={mockOnRename}
        />
      </MemoryRouter>,
    );

    // Open Delete Modal
    fireEvent.click(screen.getByText("Delete Meeting"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Escape Key press (ConfirmModal uses document listener)
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Re-open and click backdrop
    fireEvent.click(screen.getByText("Delete Meeting"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders Rename Modal with proper ARIA attributes and submits on Enter key", () => {
    render(
      <MemoryRouter>
        <MeetingActions
          meeting={mockMeeting}
          onDelete={mockOnDelete}
          onRename={mockOnRename}
        />
      </MemoryRouter>,
    );

    // Open Rename Modal
    fireEvent.click(screen.getByText("Rename Meeting"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby", "rename-modal-title");

    const input = screen.getByPlaceholderText("Enter new title");
    fireEvent.change(input, { target: { value: "Updated Sync Title" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnRename).toHaveBeenCalledWith("m123", "Updated Sync Title");
  });
});
