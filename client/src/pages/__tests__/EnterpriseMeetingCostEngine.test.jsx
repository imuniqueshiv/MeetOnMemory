import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import EnterpriseMeetingCostEngine from "../EnterpriseMeetingCostEngine.jsx";
import { getEnterpriseCostResourceEngine } from "../../services/meetingCostApi.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar" />,
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("../../services/meetingCostApi.js", () => ({
  getEnterpriseCostResourceEngine: vi.fn(),
}));

describe("EnterpriseMeetingCostEngine Page", () => {
  const mockTelemetry = {
    organizationId: "org-123",
    timeframe: "30d",
    timestamp: "2026-08-27T10:00:00.000Z",
    currency: "USD",
    summary: {
      totalFinancialInvestment: 4500,
      laborTimeCost: 4000,
      resourceBookingCost: 500,
      totalMeetingsCount: 20,
      totalHoursSpent: 18.5,
      meetingWasteScore: 25,
    },
    efficiencyMetrics: {
      costPerDecision: 300,
      costPerActionItem: 150,
      totalDecisionsCount: 15,
      totalActionItemsCount: 30,
      resourceUtilizationRate: 65,
    },
    savingsOpportunities: {
      potentialLaborSavings: 720,
      lowYieldMeetingCount: 2,
      recommendations: [
        "Financial meeting expenditures and physical resource utilization are performing efficiently across your enterprise.",
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially and then displays cost engine telemetry data", async () => {
    getEnterpriseCostResourceEngine.mockResolvedValueOnce({
      success: true,
      telemetry: mockTelemetry,
    });

    render(
      <MemoryRouter>
        <EnterpriseMeetingCostEngine />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/computing financial cost engine metrics/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Enterprise Meeting Cost & Resource Engine"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("$4,500")).toBeInTheDocument();
    expect(screen.getByText("18.5")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("$720")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Financial meeting expenditures and physical resource utilization are performing efficiently across your enterprise.",
      ),
    ).toBeInTheDocument();
  });

  it("handles timeframe changes and refetches telemetry", async () => {
    getEnterpriseCostResourceEngine.mockResolvedValue({
      success: true,
      telemetry: mockTelemetry,
    });

    render(
      <MemoryRouter>
        <EnterpriseMeetingCostEngine />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Enterprise Meeting Cost & Resource Engine"),
      ).toBeInTheDocument();
    });

    expect(getEnterpriseCostResourceEngine).toHaveBeenCalledWith("30d");

    const sevenDaysBtn = screen.getByRole("button", { name: "7 Days" });
    fireEvent.click(sevenDaysBtn);

    await waitFor(() => {
      expect(getEnterpriseCostResourceEngine).toHaveBeenCalledWith("7d");
    });
  });

  it("renders error alert state when API call fails", async () => {
    getEnterpriseCostResourceEngine.mockRejectedValueOnce({
      response: {
        data: {
          message: "Failed to compute financial metrics",
        },
      },
    });

    render(
      <MemoryRouter>
        <EnterpriseMeetingCostEngine />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load meeting cost telemetry"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Failed to compute financial metrics"),
    ).toBeInTheDocument();
  });
});
