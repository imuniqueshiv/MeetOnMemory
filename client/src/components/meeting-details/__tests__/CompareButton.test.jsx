import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CompareButton from "../CompareButton.jsx";
import { getComparableMeetings } from "../../../services/comparisonApi";

vi.mock("../../../services/comparisonApi", () => ({
  getComparableMeetings: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("CompareButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the compare button", () => {
    render(
      <MemoryRouter>
        <CompareButton meetingId="meeting-123" />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /compare/i }),
    ).toBeInTheDocument();
  });

  it("toggles dropdown and fetches comparable meetings on click", async () => {
    const mockMeetings = [
      {
        _id: "meeting-456",
        title: "Comparable Meeting",
        date: "2026-08-25T12:00:00.000Z",
      },
    ];
    vi.mocked(getComparableMeetings).mockResolvedValue(mockMeetings);

    render(
      <MemoryRouter>
        <CompareButton meetingId="meeting-123" />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /compare/i });
    fireEvent.click(button);

    expect(screen.getByText(/compare with\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Comparable Meeting")).toBeInTheDocument();
    });
  });

  it("navigates to comparison page when a meeting option is clicked", async () => {
    const mockMeetings = [
      {
        _id: "meeting-456",
        title: "Comparable Meeting",
        date: "2026-08-25T12:00:00.000Z",
      },
    ];
    vi.mocked(getComparableMeetings).mockResolvedValue(mockMeetings);

    render(
      <MemoryRouter>
        <CompareButton meetingId="meeting-123" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /compare/i }));

    await waitFor(() => {
      expect(screen.getByText("Comparable Meeting")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Comparable Meeting"));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/meetings/compare?meetingA=meeting-123&meetingB=meeting-456",
    );
  });
});
