import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingComparison from "../MeetingComparison.jsx";
import {
  compareMeetings,
  getComparableMeetings,
} from "../../services/comparisonApi";

vi.mock("../../services/comparisonApi", () => ({
  compareMeetings: vi.fn(),
  getComparableMeetings: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [
      new URLSearchParams({ meetingA: "meeting-1", meetingB: "meeting-2" }),
    ],
  };
});

describe("MeetingComparison Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders comparison details and metrics correctly", async () => {
    const mockData = {
      meetingA: {
        _id: "meeting-1",
        title: "Alpha Meeting",
        date: "2026-08-25T12:00:00.000Z",
        summary: "This is Alpha summary",
      },
      meetingB: {
        _id: "meeting-2",
        title: "Beta Meeting",
        date: "2026-08-26T12:00:00.000Z",
        summary: "This is Beta summary",
      },
      actionItemsDiff: {
        resolved: [{ item: { task: "Action 1", owner: "User A" } }],
        added: [{ item: { task: "Action 2", owner: "User B" } }],
        carriedOver: [],
      },
      decisionsDiff: {
        resolved: [],
        added: [{ item: "Decision 1" }],
        carriedOver: [],
      },
      aiSummary: "The meetings progressed smoothly with minimal divergence.",
    };

    vi.mocked(compareMeetings).mockResolvedValue(mockData);
    vi.mocked(getComparableMeetings).mockResolvedValue([
      {
        _id: "meeting-2",
        title: "Beta Meeting",
        date: "2026-08-26T12:00:00.000Z",
      },
      {
        _id: "meeting-3",
        title: "Gamma Meeting",
        date: "2026-08-27T12:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter
        initialEntries={[
          "/meetings/compare?meetingA=meeting-1&meetingB=meeting-2",
        ]}
      >
        <Routes>
          <Route path="/meetings/compare" element={<MeetingComparison />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha Meeting")).toBeInTheDocument();
      expect(screen.getByText("Beta Meeting")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The meetings progressed smoothly with minimal divergence.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Action 1 (User A)")).toBeInTheDocument();
      expect(screen.getByText("Action 2 (User B)")).toBeInTheDocument();
      expect(screen.getByText("Decision 1")).toBeInTheDocument();
    });
  });

  it("handles API loading errors gracefully", async () => {
    vi.mocked(compareMeetings).mockRejectedValue(new Error("Network Error"));
    vi.mocked(getComparableMeetings).mockResolvedValue([]);

    render(
      <MemoryRouter
        initialEntries={[
          "/meetings/compare?meetingA=meeting-1&meetingB=meeting-2",
        ]}
      >
        <Routes>
          <Route path="/meetings/compare" element={<MeetingComparison />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load comparison data."),
      ).toBeInTheDocument();
    });
  });
});
