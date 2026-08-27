import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import EnterpriseOkrAlignmentTelemetry from "../EnterpriseOkrAlignmentTelemetry.jsx";
import { knowledgeApi } from "../../services";

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

vi.mock("../../services", () => ({
  knowledgeApi: {
    getOkrAlignmentTelemetry: vi.fn(),
  },
}));

describe("EnterpriseOkrAlignmentTelemetry Page", () => {
  const mockOkrTelemetry = {
    organizationId: "org-123",
    timeframe: "30d",
    timestamp: "2026-08-27T10:00:00.000Z",
    summary: {
      totalObjectives: 12,
      activeKeyResults: 45,
      overallAlignmentScore: 84,
      overallHealthScore: 89,
      atRiskObjectivesCount: 2,
      unalignedMemoriesCount: 5,
    },
    objectiveStatusBreakdown: {
      on_track: 7,
      at_risk: 2,
      behind: 1,
      achieved: 2,
    },
    pillarDistribution: [
      { name: "Product Excellence", alignedCount: 15, percentage: 33 },
      { name: "Customer Growth", alignedCount: 12, percentage: 27 },
      { name: "Operational Efficiency", alignedCount: 8, percentage: 18 },
      { name: "Security & Governance", alignedCount: 6, percentage: 13 },
      { name: "Platform Innovation", alignedCount: 4, percentage: 9 },
    ],
    misalignmentDiagnostics: {
      unmappedDecisions: 3,
      unmappedActionItems: 2,
      unalignedTotal: 5,
      unalignedPercentage: 11,
    },
    recommendations: [
      "Enterprise OKR alignment and strategic goal progress are performing optimally across all pillars.",
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially and then displays OKR telemetry data", async () => {
    knowledgeApi.getOkrAlignmentTelemetry.mockResolvedValueOnce({
      data: {
        success: true,
        telemetry: mockOkrTelemetry,
      },
    });

    render(
      <MemoryRouter>
        <EnterpriseOkrAlignmentTelemetry />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/loading okr alignment telemetry/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Enterprise OKR Alignment Telemetry"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enterprise OKR alignment and strategic goal progress are performing optimally across all pillars.",
      ),
    ).toBeInTheDocument();
  });

  it("handles timeframe changes and refetches OKR telemetry", async () => {
    knowledgeApi.getOkrAlignmentTelemetry.mockResolvedValue({
      data: {
        success: true,
        telemetry: mockOkrTelemetry,
      },
    });

    render(
      <MemoryRouter>
        <EnterpriseOkrAlignmentTelemetry />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Enterprise OKR Alignment Telemetry"),
      ).toBeInTheDocument();
    });

    expect(knowledgeApi.getOkrAlignmentTelemetry).toHaveBeenCalledWith("30d");

    const sevenDaysBtn = screen.getByRole("button", { name: "7 Days" });
    fireEvent.click(sevenDaysBtn);

    await waitFor(() => {
      expect(knowledgeApi.getOkrAlignmentTelemetry).toHaveBeenCalledWith("7d");
    });
  });

  it("renders error alert state when API call fails", async () => {
    knowledgeApi.getOkrAlignmentTelemetry.mockRejectedValueOnce({
      response: {
        data: {
          message: "Failed to load OKR metrics",
        },
      },
    });

    render(
      <MemoryRouter>
        <EnterpriseOkrAlignmentTelemetry />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load OKR telemetry"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Failed to load OKR metrics")).toBeInTheDocument();
  });
});
