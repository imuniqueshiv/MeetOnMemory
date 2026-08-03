import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingCard from "../MeetingCard";

vi.mock("../../../hooks/useExport.js", () => ({
  default: () => ({
    exportMeeting: vi.fn(),
    isExporting: false,
  }),
}));

const baseMeeting = {
  _id: "mtg-1",
  title: "Sprint Planning",
  status: "completed",
  meetingType: "conference",
  date: "2026-07-01T00:00:00.000Z",
  createdAt: "2026-07-01T00:00:00.000Z",
  duration: 45,
  summary: "Discussed backlog priorities",
  tags: ["planning", "sprint"],
  participants: [{ name: "Alex" }],
};

describe("MeetingCard dark mode (#728)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies theme-aware classes for card surfaces and typography", () => {
    render(
      <MeetingCard
        meeting={baseMeeting}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onView={vi.fn()}
      />,
    );

    const card = screen.getByTestId("meeting-card");
    expect(card.className).toContain("dark:bg-gray-900");
    expect(card.className).toContain("dark:border-gray-800");
    expect(screen.getByText("Sprint Planning").className).toContain(
      "dark:text-white",
    );
    expect(screen.getByText("completed").className).toContain(
      "dark:bg-green-950/70",
    );
    expect(screen.getByText("conference").className).toContain(
      "dark:bg-blue-950/60",
    );
    expect(screen.getByText("View Details").className).toContain(
      "dark:text-blue-400",
    );
  });

  it("keeps action menu interactive and theme-aware", () => {
    const onView = vi.fn();
    render(
      <MeetingCard
        meeting={baseMeeting}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onView={onView}
      />,
    );

    fireEvent.click(screen.getByLabelText("Meeting actions"));
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Delete").className).toContain("dark:text-red-400");

    fireEvent.click(screen.getByText("View Details"));
    expect(onView).toHaveBeenCalledWith(baseMeeting);
  });

  it("renders light-mode base classes alongside dark variants", () => {
    render(
      <MeetingCard
        meeting={{ ...baseMeeting, status: "processing" }}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onView={vi.fn()}
      />,
    );

    const card = screen.getByTestId("meeting-card");
    expect(card.className).toContain("bg-white");
    expect(screen.getByText("processing").className).toContain("bg-yellow-100");
    expect(screen.getByText("processing").className).toContain(
      "dark:bg-yellow-950/70",
    );
  });
});
