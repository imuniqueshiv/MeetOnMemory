import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DecisionDependencyMatrix from "../DecisionDependencyMatrix.jsx";
import { getDecisionDependencyMatrix } from "../../services/decisionGraphApi.js";

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

vi.mock("../../services/decisionGraphApi.js", () => ({
  getDecisionDependencyMatrix: vi.fn(),
}));

describe("DecisionDependencyMatrix Page", () => {
  const mockMatrixPayload = {
    nodes: [
      {
        id: "dec-1",
        label: "Adopt Microservices Architecture",
        owner: "Engineering",
        status: "open",
        importanceScore: 85,
        inDegree: 0,
        outDegree: 1,
        inCycle: false,
      },
      {
        id: "dec-2",
        label: "Migrate Auth to OAuth 2.0",
        owner: "Security",
        status: "resolved",
        importanceScore: 70,
        inDegree: 1,
        outDegree: 0,
        inCycle: false,
      },
    ],
    matrix: [
      [
        { type: "self", confidence: null },
        { type: "relatesTo", confidence: 90 },
      ],
      [
        { type: "none", confidence: null },
        { type: "self", confidence: null },
      ],
    ],
    summary: {
      totalDecisions: 2,
      totalDependencies: 1,
      matrixDensityPercentage: 50,
      cyclesCount: 0,
    },
    cycles: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially and then displays 2D dependency matrix", async () => {
    getDecisionDependencyMatrix.mockResolvedValueOnce(mockMatrixPayload);

    render(
      <MemoryRouter>
        <DecisionDependencyMatrix />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/generating decision dependency matrix/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Decision Dependency Matrix"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("2D Decision Cross-Tabular Matrix"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Adopt Microservices Architecture"),
    ).toBeInTheDocument();
    expect(screen.getByText("relates")).toBeInTheDocument();
  });

  it("opens cell detail modal on clicking a matrix cell", async () => {
    getDecisionDependencyMatrix.mockResolvedValueOnce(mockMatrixPayload);

    render(
      <MemoryRouter>
        <DecisionDependencyMatrix />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("relates")).toBeInTheDocument();
    });

    const relatesBadge = screen.getByText("relates");
    fireEvent.click(relatesBadge);

    expect(screen.getByText("Dependency Detail")).toBeInTheDocument();
    expect(
      screen.getByText("Adopt Microservices Architecture"),
    ).toBeInTheDocument();
    expect(screen.getByText("Migrate Auth to OAuth 2.0")).toBeInTheDocument();
  });

  it("renders error state when matrix fetch fails", async () => {
    getDecisionDependencyMatrix.mockRejectedValueOnce({
      response: {
        data: {
          message: "Failed to load matrix data",
        },
      },
    });

    render(
      <MemoryRouter>
        <DecisionDependencyMatrix />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load dependency matrix"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Failed to load matrix data")).toBeInTheDocument();
  });
});
