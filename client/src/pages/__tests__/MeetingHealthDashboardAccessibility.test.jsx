import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingHealthDashboard from "../MeetingHealthDashboard.jsx";
import AppContent from "../../context/AppContent";
import { meetingHealthApi } from "../../services/meetingHealthApi";

vi.mock("../../services/meetingHealthApi", () => ({
  meetingHealthApi: {
    getOrganizationHealthTrends: vi.fn(),
  },
}));

describe("MeetingHealthDashboard Accessibility (#1611)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders chart region and factor benchmark progressbars with ARIA attributes", async () => {
    meetingHealthApi.getOrganizationHealthTrends.mockResolvedValue({
      success: true,
      data: {
        trends: [
          {
            _id: "t1",
            compositeScore: 85,
            meetingId: { title: "Executive Review" },
          },
        ],
        benchmarks: {
          averageComposite: 85,
          averageEngagement: 88,
          averageAgendaCoverage: 90,
          averageTimeAdherence: 82,
          averageActionItemClarity: 78,
          averageSentiment: 80,
        },
      },
    });

    render(
      <MemoryRouter>
        <AppContent.Provider
          value={{
            userData: { organization: { _id: "org-123" } },
            loading: false,
          }}
        >
          <MeetingHealthDashboard />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /composite score trend chart/i }),
      ).toBeInTheDocument();
    });

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars.length).toBe(5);

    const agendaProgress = screen.getByRole("progressbar", {
      name: /agenda coverage percentage/i,
    });
    expect(agendaProgress).toHaveAttribute("aria-valuenow", "90");
    expect(agendaProgress).toHaveAttribute("aria-valuemin", "0");
    expect(agendaProgress).toHaveAttribute("aria-valuemax", "100");
  });
});
