import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TaskDetailsModal from "../TaskDetailsModal.jsx";

const mockTask = {
  id: "task-1",
  title: "Review Architecture Doc",
  description: "Verify clean architecture compliance.",
  status: "pending",
  priority: "high",
  owner: "Pratyush",
  dueDate: "2026-08-10T00:00:00.000Z",
  organization: "Engineering",
  meetingDate: "2026-08-01T00:00:00.000Z",
  meetingTitle: "Sprint Planning",
  meetingId: "meeting-123",
};

describe("TaskDetailsModal Accessibility (#1226)", () => {
  it("renders null when selectedTask is null", () => {
    const { container } = render(
      <TaskDetailsModal
        selectedTask={null}
        setSelectedTask={() => {}}
        navigate={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("exposes correct WAI-ARIA dialog attributes when open", () => {
    render(
      <TaskDetailsModal
        selectedTask={mockTask}
        setSelectedTask={() => {}}
        navigate={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-describedby");
    expect(screen.getByText("Review Architecture Doc")).toBeInTheDocument();
  });

  it("closes modal on Escape key press", () => {
    const setSelectedTask = vi.fn();
    render(
      <TaskDetailsModal
        selectedTask={mockTask}
        setSelectedTask={setSelectedTask}
        navigate={() => {}}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(setSelectedTask).toHaveBeenCalledWith(null);
  });

  it("closes modal when close button is clicked", () => {
    const setSelectedTask = vi.fn();
    render(
      <TaskDetailsModal
        selectedTask={mockTask}
        setSelectedTask={setSelectedTask}
        navigate={() => {}}
      />,
    );

    const closeButton = screen.getByRole("button", {
      name: /close task details/i,
    });
    fireEvent.click(closeButton);
    expect(setSelectedTask).toHaveBeenCalledWith(null);
  });
});
