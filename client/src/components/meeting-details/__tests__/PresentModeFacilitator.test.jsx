import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PresentMode from "../PresentMode";

vi.mock("../../../context/useTheme.jsx", () => ({
  default: () => ({ theme: "light" }),
}));

describe("PresentMode Facilitator Surface (#2013)", () => {
  const mockMeeting = {
    _id: "m-fac-123",
    title: "Quarterly Strategy Facilitation",
    date: "2026-08-20T10:00:00.000Z",
    duration: 60,
    agendaItems: [
      {
        text: "Intro & Icebreaker",
        duration: 10,
        description: "Kickoff round",
      },
      { text: "Financial Review", duration: 25, description: "Q2 metrics" },
    ],
    actionItems: [
      {
        id: "act-1",
        task: "Prepare pitch deck",
        owner: "Sarah",
        completed: false,
      },
    ],
    polls: [
      {
        id: "poll-1",
        question: "Approve budget increase?",
        options: [
          { id: "opt-1", text: "Yes", votes: 3 },
          { id: "opt-2", text: "No", votes: 1 },
        ],
      },
    ],
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders facilitator mode tabs and controls", () => {
    render(<PresentMode meeting={mockMeeting} onClose={mockOnClose} />);

    expect(screen.getByText(/Facilitator Mode/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Agenda \(2\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Slides/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Polls \(1\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Actions \(1\)/i }),
    ).toBeInTheDocument();
  });

  it("switches to Polls mode and registers a live vote", () => {
    render(<PresentMode meeting={mockMeeting} onClose={mockOnClose} />);

    const pollsTab = screen.getByRole("button", { name: /Polls \(1\)/i });
    fireEvent.click(pollsTab);

    expect(screen.getByText(/Live Facilitator Polls/i)).toBeInTheDocument();
    expect(screen.getByText(/Approve budget increase\?/i)).toBeInTheDocument();

    const voteButtons = screen.getAllByRole("button", { name: /\+1 Vote/i });
    expect(voteButtons.length).toBeGreaterThan(0);
    fireEvent.click(voteButtons[0]);

    // Vote count incremented
    expect(screen.getByText(/4 votes/i)).toBeInTheDocument();
  });

  it("switches to Actions mode, adds an action item and toggles completion", () => {
    render(<PresentMode meeting={mockMeeting} onClose={mockOnClose} />);

    const actionsTab = screen.getByRole("button", { name: /Actions \(1\)/i });
    fireEvent.click(actionsTab);

    expect(screen.getByText(/Facilitator Action Items/i)).toBeInTheDocument();
    expect(screen.getByText(/Prepare pitch deck/i)).toBeInTheDocument();

    // Add new action
    const descInput = screen.getByPlaceholderText(/Action Item description/i);
    const ownerInput = screen.getByPlaceholderText(/Assignee/i);
    const addBtn = screen.getByRole("button", { name: /Add Action/i });

    fireEvent.change(descInput, { target: { value: "Follow up with client" } });
    fireEvent.change(ownerInput, { target: { value: "Alex" } });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Follow up with client/i)).toBeInTheDocument();

    // Toggle completion
    const newActionCard = screen
      .getByText(/Follow up with client/i)
      .closest("div");
    fireEvent.click(newActionCard);
    expect(screen.getByText(/Follow up with client/i)).toHaveClass(
      "line-through",
    );
  });

  it("allows extending timer by +1m and +5m", () => {
    render(<PresentMode meeting={mockMeeting} onClose={mockOnClose} />);

    const add1mBtn = screen.getByRole("button", { name: /\+1m/i });
    fireEvent.click(add1mBtn);

    const pauseBtn = screen.getByRole("button", { name: /Pause timer/i });
    expect(pauseBtn).toBeInTheDocument();
    fireEvent.click(pauseBtn);

    expect(
      screen.getByRole("button", { name: /Resume timer/i }),
    ).toBeInTheDocument();
  });
});
