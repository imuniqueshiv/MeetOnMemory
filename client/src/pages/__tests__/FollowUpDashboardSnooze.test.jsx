import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import FollowUpDashboard from "../FollowUpDashboard.jsx";
import apiClient from "../../services/apiClient.js";
import AppContent from "../../context/AppContent";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="app-navbar">App Navbar</div>,
}));

vi.mock("../../components/tasks/TaskDetailsModal.jsx", () => ({
  default: () => null,
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockAnalytics = {
  pendingCount: 1,
  overdueCount: 0,
  completedCount: 1,
  complianceRate: 100,
};

const mockTasks = [
  {
    _id: "task-101",
    title: "Implement Auth Flow",
    status: "pending",
    deadline: new Date(Date.now() + 86400000).toISOString(),
    acknowledged: false,
    meeting: { title: "Sprint Planning", _id: "meet-1" },
    metadata: { priority: "high" },
  },
];

describe("FollowUpDashboard — Snooze, Escalate Curation UI integration (#2475)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    apiClient.get.mockImplementation((url) => {
      if (url === "/api/followup/analytics") {
        return Promise.resolve({ data: mockAnalytics });
      }
      if (url === "/api/followup/tasks") {
        return Promise.resolve({
          data: {
            tasks: mockTasks,
            pagination: { total: 1, totalPages: 1 },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("persists status filter in localStorage and supports task snooze & escalation modals", async () => {
    apiClient.patch.mockResolvedValue({ data: { success: true } });
    apiClient.post.mockResolvedValue({ data: { success: true } });

    render(
      <AppContent.Provider
        value={{ userData: { _id: "admin_1", role: "admin" } }}
      >
        <MemoryRouter initialEntries={["/followup"]}>
          <Routes>
            <Route path="/followup" element={<FollowUpDashboard />} />
          </Routes>
        </MemoryRouter>
      </AppContent.Provider>,
    );

    // Verify page loads
    expect(await screen.findByText("Follow-Up Dashboard")).toBeInTheDocument();

    // Verify localStorage filter is read on mount (defaults to "all")
    expect(localStorage.getItem("meetonmemory:followup_status_filter")).toBe(
      "all",
    );

    // Click "Pending" filter button
    const pendingFilterBtn = screen.getByText("Pending");
    fireEvent.click(pendingFilterBtn);

    // Verify filter change persists in localStorage
    expect(localStorage.getItem("meetonmemory:followup_status_filter")).toBe(
      "pending",
    );

    // Verify Snooze button is rendered
    const snoozeBtn = screen.getByTestId("snooze-btn-task-101");
    expect(snoozeBtn).toBeInTheDocument();

    // Click Snooze button
    fireEvent.click(snoozeBtn);

    // Verify Snooze modal opens
    expect(await screen.findByText("Snooze Task")).toBeInTheDocument();

    // Click "1 Hour" snooze option
    const oneHourBtn = screen.getByText("1 Hour");
    fireEvent.click(oneHourBtn);

    // Verify patch endpoint is triggered
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/followup/tasks/task-101/snooze",
        expect.objectContaining({ snoozedUntil: expect.any(String) }),
      );
    });

    // Verify Escalate button is rendered (user role is admin)
    const escalateBtn = screen.getByTestId("escalate-btn-task-101");
    expect(escalateBtn).toBeInTheDocument();

    // Click Escalate button
    fireEvent.click(escalateBtn);

    // Verify Escalate modal opens
    expect(await screen.findByText("Escalate Task")).toBeInTheDocument();

    // Fill in escalation reason
    const reasonInput = screen.getByPlaceholderText(
      /Reason for manual escalation/,
    );
    fireEvent.change(reasonInput, {
      target: { value: "Task assignee is blocked" },
    });

    // Click confirm escalation
    const confirmEscalateBtn = screen.getByText("Confirm Escalation");
    fireEvent.click(confirmEscalateBtn);

    // Verify post escalate endpoint is triggered
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/followup/escalate/task-101",
        { reason: "Task assignee is blocked" },
      );
    });
  });
});
