import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SlaCompliance from "../SlaCompliance.jsx";
import AppContent from "../../context/AppContent";
import {
  getSlaBreaches,
  getSlaComplianceStats,
  notifyBreach,
} from "../../services/actionItemSlaApi";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="app-navbar">App Navbar</div>,
}));

vi.mock("../../services/actionItemSlaApi", () => ({
  getSlaBreaches: vi.fn(),
  getSlaComplianceStats: vi.fn(),
  acknowledgeBreach: vi.fn(),
  notifyBreach: vi.fn(),
}));

const mockStats = {
  totalBreaches: 1,
  openBreaches: 1,
  breachesByAssignee: [
    {
      assignee: {
        _id: "user_1",
        name: "Alice Developer",
        email: "alice@example.com",
      },
      count: 1,
    },
  ],
};

const mockBreaches = [
  {
    _id: "breach_1",
    breachType: "resolution",
    priority: "high",
    severity: "high",
    targetHours: 24,
    actualHours: 36,
    status: "open",
    createdAt: "2026-08-27T10:00:00.000Z",
    assignee: {
      _id: "user_1",
      name: "Alice Developer",
      email: "alice@example.com",
    },
    actionItem: {
      _id: "item_1",
      text: "Resolve database memory leak",
      sourceMeetingId: "meeting_1",
    },
  },
];

describe("SlaCompliance — Alerts & Drilldown Curation UI integration (#2474)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders breaches with severity, supports notifying and workload drill-down modal", async () => {
    getSlaComplianceStats.mockResolvedValue(mockStats);
    getSlaBreaches.mockImplementation(async (orgId, params) => {
      // Mock filtering by assignee if requested
      if (params && params.assignee === "user_1") {
        return mockBreaches;
      }
      return mockBreaches;
    });
    notifyBreach.mockResolvedValue({ success: true });

    render(
      <AppContent.Provider
        value={{
          userData: {
            _id: "admin_1",
            role: "admin",
            currentOrganization: { _id: "org_1" },
          },
        }}
      >
        <MemoryRouter>
          <SlaCompliance />
        </MemoryRouter>
      </AppContent.Provider>,
    );

    // Verify stats load
    expect(
      await screen.findByText("SLA Compliance Dashboard"),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Developer")).toBeInTheDocument();

    // Verify severity tag is displayed in the list
    expect(screen.getByText("high")).toBeInTheDocument();

    // Verify Admin Notify button is rendered
    const notifyBtn = screen.getByTestId("notify-btn-breach_1");
    expect(notifyBtn).toBeInTheDocument();

    // Click Notify button and verify API trigger
    fireEvent.click(notifyBtn);
    await waitFor(() => {
      expect(notifyBreach).toHaveBeenCalledWith("breach_1");
    });

    // Click on assignee row to trigger drill-down modal
    const assigneeCardLink = screen.getByTestId("assignee-drill-down-user_1");
    fireEvent.click(assigneeCardLink);

    // Verify Drill-down Workload Modal loads
    expect(
      await screen.findByText("Workload: Alice Developer (alice@example.com)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Resolve database memory leak"),
    ).toBeInTheDocument();
    expect(screen.getByText("36h / 24h target")).toBeInTheDocument();

    // Verify drill-down deep links exist
    const viewMeetingLink = screen.getByText("View Meeting");
    expect(viewMeetingLink).toHaveAttribute("href", "/meeting/meeting_1");

    const viewTasksLink = screen.getByText("Go to Task Board");
    expect(viewTasksLink).toHaveAttribute("href", "/tasks");
  });
});
