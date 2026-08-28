import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import EnterpriseMemoryTelemetry from "../EnterpriseMemoryTelemetry.jsx";
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
    getMemoryTelemetry: vi.fn(),
  },
}));

describe("EnterpriseMemoryTelemetry Page", () => {
  const mockTelemetry = {
    organizationId: "org-123",
    timeframe: "30d",
    timestamp: "2026-08-27T10:00:00.000Z",
    summary: {
      totalMemories: 42,
      decisionsCount: 20,
      actionItemsCount: 22,
      memoryHealthScore: 88,
      activeRatioPercentage: 75,
    },
    lifecycleDistribution: {
      active: 30,
      dormant: 8,
      archived: 3,
      expired: 1,
    },
    importanceMetrics: {
      averageScore: 68.5,
      protectedCount: 15,
      protectedPercentage: 36,
      distribution: {
        high: 15,
        medium: 20,
        low: 7,
      },
    },
    velocityMetrics: {
      totalAccesses: 150,
      createdInTimeframe: 10,
      accessedInTimeframe: 25,
      avgDaysSinceLastAccess: 4.2,
    },
    consolidationMetrics: {
      mergedMemoriesCount: 5,
      totalTransitionsLogged: 12,
    },
    recommendations: [
      "Memory retention and health metrics are optimal across your organization.",
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially and then displays telemetry data", async () => {
    knowledgeApi.getMemoryTelemetry.mockResolvedValueOnce({
      data: {
        success: true,
        telemetry: mockTelemetry,
      },
    });

    render(
      <MemoryRouter>
        <EnterpriseMemoryTelemetry />
      </MemoryRouter>,
    );

    expect(screen.getByText(/loading telemetry metrics/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Enterprise Memory Telemetry"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Memory retention and health metrics are optimal across your organization.",
      ),
    ).toBeInTheDocument();
  });

  it("handles timeframe changes and refetches telemetry", async () => {
    knowledgeApi.getMemoryTelemetry.mockResolvedValue({
      data: {
        success: true,
        telemetry: mockTelemetry,
      },
    });

    render(
      <MemoryRouter>
        <EnterpriseMemoryTelemetry />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Enterprise Memory Telemetry"),
      ).toBeInTheDocument();
    });

    expect(knowledgeApi.getMemoryTelemetry).toHaveBeenCalledWith("30d");

    const sevenDaysBtn = screen.getByRole("button", { name: "7 Days" });
    fireEvent.click(sevenDaysBtn);

    await waitFor(() => {
      expect(knowledgeApi.getMemoryTelemetry).toHaveBeenCalledWith("7d");
    });
  });

  it("renders error alert state when API call fails", async () => {
    knowledgeApi.getMemoryTelemetry.mockRejectedValueOnce({
      response: {
        data: {
          message: "Organization context missing",
        },
      },
    });

    render(
      <MemoryRouter>
        <EnterpriseMemoryTelemetry />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Unable to load telemetry")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Organization context missing"),
    ).toBeInTheDocument();
  });
});
