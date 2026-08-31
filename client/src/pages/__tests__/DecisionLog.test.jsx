import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DecisionLog from "../DecisionLog.jsx";
import {
  getDecisionLog,
  getDecisionTimeline,
  updateDecisionOutcome,
} from "../../services/decisionLogApi";

vi.mock("../../services/decisionLogApi", () => ({
  getDecisionLog: vi.fn(),
  getDecisionTimeline: vi.fn(),
  updateDecisionOutcome: vi.fn(),
}));

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe("DecisionLog Page Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLogEntries = [
    {
      _id: "entry_1",
      decisionId: { text: "Use Vitest for unit testing" },
      decidedBy: { name: "Ada Lovelace" },
      outcome: "implemented",
      createdAt: "2026-08-30T12:00:00.000Z",
      impactAssessment: "Improved test speed by 50%",
      linkedActionItems: [
        { _id: "item_1", text: "Configure vitest", status: "completed" },
      ],
    },
  ];

  const mockTimeline = [
    {
      monthYear: "Aug 2026",
      implemented: 1,
      pending: 0,
      deferred: 0,
      reversed: 0,
      superseded: 0,
    },
  ];

  it("renders decision log header and filters", async () => {
    getDecisionLog.mockResolvedValueOnce({ entries: mockLogEntries });
    getDecisionTimeline.mockResolvedValueOnce(mockTimeline);

    render(<DecisionLog />);

    expect(screen.getByText("Decision Log")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders loader initially and then log entries", async () => {
    getDecisionLog.mockResolvedValueOnce({ entries: mockLogEntries });
    getDecisionTimeline.mockResolvedValueOnce(mockTimeline);

    render(<DecisionLog />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Use Vitest for unit testing"),
      ).toBeInTheDocument();
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
  });

  it("shows empty state if no decisions are found", async () => {
    getDecisionLog.mockResolvedValueOnce({ entries: [] });
    getDecisionTimeline.mockResolvedValueOnce([]);

    render(<DecisionLog />);

    await waitFor(() => {
      expect(screen.getByText("No decisions found.")).toBeInTheDocument();
    });
  });

  it("expands decision detail panel when row is clicked", async () => {
    getDecisionLog.mockResolvedValueOnce({ entries: mockLogEntries });
    getDecisionTimeline.mockResolvedValueOnce(mockTimeline);

    render(<DecisionLog />);

    await waitFor(() => {
      expect(
        screen.getByText("Use Vitest for unit testing"),
      ).toBeInTheDocument();
    });

    // Click row to expand
    fireEvent.click(screen.getByText("Use Vitest for unit testing"));

    expect(screen.getByText("Improved test speed by 50%")).toBeInTheDocument();
    expect(
      screen.getByText("Configure vitest - completed"),
    ).toBeInTheDocument();
  });

  it("allows updating decision outcome in expanded panel", async () => {
    getDecisionLog.mockResolvedValue({ entries: mockLogEntries });
    getDecisionTimeline.mockResolvedValue(mockTimeline);
    updateDecisionOutcome.mockResolvedValueOnce({ success: true });

    render(<DecisionLog />);

    await waitFor(() => {
      expect(
        screen.getByText("Use Vitest for unit testing"),
      ).toBeInTheDocument();
    });

    // Expand
    fireEvent.click(screen.getByText("Use Vitest for unit testing"));

    // Find select element in panel
    const select = screen.getAllByRole("combobox")[1];
    fireEvent.change(select, { target: { value: "reversed" } });

    expect(updateDecisionOutcome).toHaveBeenCalledWith("entry_1", {
      outcome: "reversed",
    });
  });
});
