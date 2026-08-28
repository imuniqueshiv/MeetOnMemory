import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingCostCard from "../MeetingCostCard";
import * as costApi from "../../../services/meetingCostApi";

vi.mock("../../../services/meetingCostApi", () => ({
  getMeetingCostDetails: vi.fn(),
}));

describe("MeetingCostCard (#2427)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCostData = {
    totalCost: 180,
    currency: "USD",
    hourlyRate: 75,
    participantCount: 4,
    durationMinutes: 35,
    decisionsCount: 2,
    actionItemsCount: 3,
    costPerDecision: 90,
    costPerActionItem: 60,
    isBudgetExceeded: false,
    budgetThreshold: 250,
  };

  it("renders financial investment metrics and optimal budget badge", async () => {
    vi.spyOn(costApi, "getMeetingCostDetails").mockResolvedValue({
      success: true,
      data: mockCostData,
    });

    render(<MeetingCostCard meetingId="m_123" />);

    await waitFor(() => {
      expect(
        screen.getByText("Financial Investment & ROI"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("$180")).toBeInTheDocument();
    expect(screen.getByText("35m")).toBeInTheDocument();
    expect(screen.getByText("$90")).toBeInTheDocument();
    expect(screen.getByText("$60")).toBeInTheDocument();
    expect(screen.getByTestId("cost-budget-badge")).toHaveTextContent(
      "Optimal Investment",
    );
  });

  it("displays budget threshold warning when budget is exceeded", async () => {
    vi.spyOn(costApi, "getMeetingCostDetails").mockResolvedValue({
      success: true,
      data: {
        ...mockCostData,
        totalCost: 450,
        isBudgetExceeded: true,
      },
    });

    render(<MeetingCostCard meetingId="m_123" />);

    await waitFor(() => {
      expect(screen.getByTestId("cost-budget-badge")).toHaveTextContent(
        "Budget Threshold Exceeded",
      );
    });
  });
});
