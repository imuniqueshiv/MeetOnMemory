import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingCostAnalytics from "../MeetingCostAnalytics";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../services", () => ({
  getOrgCostAnalytics: vi.fn(),
  getMemberTimeStats: vi.fn(),
  exportCostReport: vi.fn(),
}));

import {
  getOrgCostAnalytics,
  getMemberTimeStats,
  exportCostReport,
} from "../../services";

const sampleAnalytics = {
  currency: "USD",
  totalCost: 1200,
  totalTimeHours: 18.5,
  mostExpensiveMeeting: { title: "Budget Review", cost: 400 },
  costByMonth: [{ month: "2026-01", cost: 500 }],
  costByType: [{ type: "standup", cost: 200 }],
};

describe("MeetingCostAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while analytics are fetched", () => {
    getOrgCostAnalytics.mockReturnValue(new Promise(() => {}));
    getMemberTimeStats.mockReturnValue(new Promise(() => {}));

    render(<MeetingCostAnalytics />);

    expect(screen.getByText("Loading analytics...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders summary cards, charts, and a responsive toolbar", async () => {
    getOrgCostAnalytics.mockResolvedValue({
      success: true,
      data: sampleAnalytics,
    });
    getMemberTimeStats.mockResolvedValue({
      success: true,
      data: [
        {
          name: "Alex",
          email: "alex@example.com",
          totalMeetings: 4,
          totalHours: 6.5,
        },
      ],
    });

    render(<MeetingCostAnalytics />);

    await waitFor(() => {
      expect(
        screen.getByText("Meeting Cost & Time Analytics"),
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Export CSV/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Total Meeting Cost")).toBeInTheDocument();
    expect(screen.getByText("Cost by Month")).toBeInTheDocument();
    expect(screen.getByText("Member Time Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("shows an error state with retry when the API fails", async () => {
    getOrgCostAnalytics.mockRejectedValue(new Error("network"));
    getMemberTimeStats.mockRejectedValue(new Error("network"));

    render(<MeetingCostAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Unable to load analytics")).toBeInTheDocument();
    });

    getOrgCostAnalytics.mockResolvedValue({
      success: true,
      data: sampleAnalytics,
    });
    getMemberTimeStats.mockResolvedValue({ success: true, data: [] });

    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Meeting Cost & Time Analytics"),
      ).toBeInTheDocument();
    });
  });

  it("exports a CSV when Export CSV is clicked", async () => {
    getOrgCostAnalytics.mockResolvedValue({
      success: true,
      data: sampleAnalytics,
    });
    getMemberTimeStats.mockResolvedValue({ success: true, data: [] });
    exportCostReport.mockResolvedValue(new Blob(["a,b"]));

    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    render(<MeetingCostAnalytics />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Export CSV/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Export CSV/i }));

    await waitFor(() => {
      expect(exportCostReport).toHaveBeenCalled();
      expect(createObjectURL).toHaveBeenCalled();
    });
  });
});
