import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AttendanceAnalytics from "../AttendanceAnalytics.jsx";
import * as attendanceApi from "../../services/attendanceApi.js";

vi.mock("../../context/useTheme.jsx", () => ({
  default: () => ({ resolvedTheme: "light" }),
}));

vi.mock("../../services/attendanceApi.js", () => ({
  getAttendanceStats: vi.fn(),
  getAttendanceHeatmap: vi.fn(),
  getAttendanceTrends: vi.fn(),
  getMeetingTypeBreakdown: vi.fn(),
}));

describe("AttendanceAnalytics Date Range Validation (#1367)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attendanceApi.getAttendanceStats.mockResolvedValue({
      stats: [],
      totalMeetings: 0,
    });
    attendanceApi.getAttendanceHeatmap.mockResolvedValue([]);
    attendanceApi.getAttendanceTrends.mockResolvedValue([]);
    attendanceApi.getMeetingTypeBreakdown.mockResolvedValue([]);
  });

  it("renders role=alert inline error when start date is after end date", async () => {
    render(<AttendanceAnalytics />);

    const inputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    const startDateInput = inputs[0];

    fireEvent.change(startDateInput, {
      target: { name: "startDate", value: "2026-12-31" },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Start date cannot be after end date",
      );
    });
  });
});
