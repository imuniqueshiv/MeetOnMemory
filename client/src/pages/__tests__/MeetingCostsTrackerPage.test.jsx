import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingCostsTrackerPage from "../MeetingCostsTrackerPage";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/meeting-costs" }),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("../../services/meetingApi.js", () => ({
  meetingApi: {
    getAllMeetings: vi.fn(),
  },
}));

import { meetingApi } from "../../services/meetingApi.js";

const sampleMeetings = [
  {
    _id: "m1",
    title: "Weekly Eng Sync",
    team: "Engineering",
    participantsCount: 6,
    durationMinutes: 60,
    frequency: "weekly",
  },
  {
    _id: "m2",
    title: "Daily Product Standup",
    team: "Product",
    participantsCount: 4,
    durationMinutes: 30,
    frequency: "daily",
  },
];

describe("MeetingCostsTrackerPage (Issue #2613)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header title, salary config bar, and KPI cards", async () => {
    meetingApi.getAllMeetings.mockResolvedValue({
      data: { meetings: sampleMeetings },
    });

    render(<MeetingCostsTrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Meeting Cost Tracker")).toBeInTheDocument();
    });

    expect(screen.getByText("Monthly Meeting Cost")).toBeInTheDocument();
    expect(screen.getByText("Total Person-Hours")).toBeInTheDocument();
    expect(screen.getByText("Avg Cost / Meeting")).toBeInTheDocument();
    expect(screen.getByText("Projected Annual Savings")).toBeInTheDocument();
  });

  it("filters meetings when team selector is changed", async () => {
    meetingApi.getAllMeetings.mockResolvedValue({
      data: { meetings: sampleMeetings },
    });

    render(<MeetingCostsTrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Eng Sync")).toBeInTheDocument();
      expect(screen.getByText("Daily Product Standup")).toBeInTheDocument();
    });

    const selects = screen.getAllByRole("combobox");
    const teamSelect = selects[0]; // First select is Team filter
    fireEvent.change(teamSelect, { target: { value: "Engineering" } });

    expect(screen.getByText("Weekly Eng Sync")).toBeInTheDocument();
    expect(screen.queryByText("Daily Product Standup")).not.toBeInTheDocument();
  });

  it("updates cost calculations when salary input changes", async () => {
    meetingApi.getAllMeetings.mockResolvedValue({
      data: { meetings: sampleMeetings },
    });

    render(<MeetingCostsTrackerPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Avg Team Salary/i)).toBeInTheDocument();
    });

    const salaryInput = screen.getByLabelText(/Avg Team Salary/i);
    fireEvent.change(salaryInput, { target: { value: "16000" } }); // doubles hourly rate to $100/hr

    const rateMatches = screen.getAllByText("$100.00/hr");
    expect(rateMatches.length).toBeGreaterThan(0);
  });

  it("renders recommendations with Effort level badges (Low, Medium, High)", async () => {
    meetingApi.getAllMeetings.mockResolvedValue({
      data: { meetings: sampleMeetings },
    });

    render(<MeetingCostsTrackerPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Actionable Cost-Saving Recommendations"),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Effort: Low/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Effort: Medium/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Effort: High/i).length).toBeGreaterThan(0);
  });
});
