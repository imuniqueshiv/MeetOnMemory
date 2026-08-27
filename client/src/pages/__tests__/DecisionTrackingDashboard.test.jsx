import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import DecisionTrackingDashboard from "../DecisionTrackingDashboard";
import * as decisionLogApi from "../../services/decisionLogApi";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services/decisionLogApi", () => ({
  getDecisionLog: vi.fn(),
  getDecisionTimeline: vi.fn(),
}));

describe("DecisionTrackingDashboard (#2440)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDecisions = [
    {
      _id: "dec_1",
      decision: "Adopt Micro-Frontends Architecture",
      context: "Decided to improve modular release velocity.",
      outcome: "positive",
      status: "implemented",
      category: "architecture",
      impact: "high",
      owner: { name: "Sarah Tech Lead" },
      actionItems: ["act_1", "act_2"],
      createdAt: "2026-08-20T10:00:00.000Z",
    },
    {
      _id: "dec_2",
      decision: "Migrate Auth to Clerk",
      context: "Modernize identity management.",
      outcome: "neutral",
      status: "in_progress",
      category: "security",
      impact: "critical",
      owner: { name: "Alex Architect" },
      actionItems: ["act_3"],
      createdAt: "2026-08-22T10:00:00.000Z",
    },
  ];

  it("fetches and renders live decision log records and summary metrics", async () => {
    decisionLogApi.getDecisionLog.mockResolvedValue({
      success: true,
      decisions: mockDecisions,
    });
    decisionLogApi.getDecisionTimeline.mockResolvedValue({
      success: true,
      timeline: [],
    });

    render(
      <BrowserRouter>
        <DecisionTrackingDashboard />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Decision Tracking Dashboard"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Adopt Micro-Frontends Architecture"),
    ).toBeInTheDocument();
    expect(screen.getByText("Migrate Auth to Clerk")).toBeInTheDocument();
    expect(screen.getByText("Total Decisions")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("switches tabs to Velocity and Improvements", async () => {
    decisionLogApi.getDecisionLog.mockResolvedValue({
      success: true,
      decisions: mockDecisions,
    });
    decisionLogApi.getDecisionTimeline.mockResolvedValue({
      success: true,
      timeline: [],
    });

    render(
      <BrowserRouter>
        <DecisionTrackingDashboard />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Decision Tracking Dashboard"),
      ).toBeInTheDocument();
    });

    const velocityTab = screen.getByRole("tab", { name: /Velocity/i });
    fireEvent.click(velocityTab);

    expect(
      screen.getByText("Decision Implementation Velocity"),
    ).toBeInTheDocument();

    const improvementsTab = screen.getByRole("tab", { name: /Improvements/i });
    fireEvent.click(improvementsTab);

    expect(
      screen.getByText("AI Decision Execution Optimization"),
    ).toBeInTheDocument();
  });
});
