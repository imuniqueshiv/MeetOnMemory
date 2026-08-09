import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PresentMode from "../PresentMode";

vi.mock("../../../context/useTheme.jsx", () => ({
  default: () => ({ theme: "light" }),
}));

describe("PresentMode - Dialog Accessibility (#1225)", () => {
  const mockMeeting = {
    _id: "m123",
    title: "Project Sync",
    date: "2026-08-07T10:00:00.000Z",
    duration: 45,
    summary: "A great meeting summary",
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a modal dialog with proper ARIA semantics", () => {
    render(<PresentMode meeting={mockMeeting} onClose={mockOnClose} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "present-mode-title");

    // The dialog is labelled by the meeting title heading
    const title = document.getElementById("present-mode-title");
    expect(title).toHaveTextContent("Project Sync");
  });

  it("moves focus into the dialog on open", async () => {
    render(<PresentMode meeting={mockMeeting} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(document.activeElement).toHaveAttribute(
        "aria-label",
        "Close present mode",
      );
    });
  });

  it("closes when Escape is pressed", () => {
    render(<PresentMode meeting={mockMeeting} onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("traps focus within the dialog when tabbing", async () => {
    render(<PresentMode meeting={mockMeeting} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(document.activeElement).not.toBeNull();
    });

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll(
      "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    expect(focusable.length).toBeGreaterThan(0);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus on last element, then Tab should wrap to first
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Focus on first element, then Shift+Tab should wrap to last
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("restores focus to the triggering element on unmount", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open Present Mode";
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <PresentMode meeting={mockMeeting} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(document.activeElement).not.toBe(trigger);
    });

    unmount();

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });

    document.body.removeChild(trigger);
  });
});
