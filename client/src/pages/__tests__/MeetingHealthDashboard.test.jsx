import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MeetingHealthDashboard from "../MeetingHealthDashboard.jsx";
import AppContent from "../../context/AppContent";
import { meetingHealthApi } from "../../services/meetingHealthApi";

vi.mock("../../services/meetingHealthApi", () => ({
  meetingHealthApi: {
    getOrganizationHealthTrends: vi.fn(),
  },
}));

const TRENDS_PAYLOAD = {
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
};

const renderDashboard = (userData, { loading = false } = {}) =>
  render(
    <MemoryRouter>
      <AppContent.Provider value={{ userData, loading }}>
        <MeetingHealthDashboard />
      </AppContent.Provider>
    </MemoryRouter>,
  );

describe("MeetingHealthDashboard (#2001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while health trends are fetched", () => {
    meetingHealthApi.getOrganizationHealthTrends.mockImplementation(
      () => new Promise(() => {}),
    );

    renderDashboard({ organization: { _id: "org-123" } });

    expect(
      screen.getByLabelText(/loading meeting health trends/i),
    ).toBeInTheDocument();
    expect(meetingHealthApi.getOrganizationHealthTrends).toHaveBeenCalledWith(
      "org-123",
    );
  });

  it("loads health trends when AppContext provides an organization", async () => {
    meetingHealthApi.getOrganizationHealthTrends.mockResolvedValue(
      TRENDS_PAYLOAD,
    );

    renderDashboard({ organization: { _id: "org-123", name: "Acme" } });

    expect(
      await screen.findByRole("region", {
        name: /composite score trend chart/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("meeting-health-dashboard")).toHaveAttribute(
      "data-organization-id",
      "org-123",
    );
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(meetingHealthApi.getOrganizationHealthTrends).toHaveBeenCalledWith(
      "org-123",
    );
  });

  it("uses a string organization id from userData when it is not populated", async () => {
    meetingHealthApi.getOrganizationHealthTrends.mockResolvedValue(
      TRENDS_PAYLOAD,
    );

    renderDashboard({ organization: "org-string-9" });

    expect(
      await screen.findByTestId("meeting-health-dashboard"),
    ).toHaveAttribute("data-organization-id", "org-string-9");
    expect(meetingHealthApi.getOrganizationHealthTrends).toHaveBeenCalledWith(
      "org-string-9",
    );
  });

  it("shows a join/create organization CTA instead of loading when the user has no org", async () => {
    renderDashboard({ _id: "user-1", role: "member" });

    expect(
      await screen.findByTestId("meeting-health-no-org"),
    ).toBeInTheDocument();
    expect(screen.getByText(/create organization/i)).toBeInTheDocument();
    expect(screen.getByText(/browse organizations/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/loading meeting health trends/i),
    ).not.toBeInTheDocument();
    expect(meetingHealthApi.getOrganizationHealthTrends).not.toHaveBeenCalled();
  });

  it("shows an error state when the trends API fails", async () => {
    meetingHealthApi.getOrganizationHealthTrends.mockRejectedValue({
      response: {
        data: { message: "Forbidden: Organization membership required" },
      },
    });

    renderDashboard({ organization: { _id: "org-123" } });

    expect(await screen.findByTestId("meeting-health-error")).toHaveTextContent(
      /organization membership required/i,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retries the trends request after an API failure", async () => {
    meetingHealthApi.getOrganizationHealthTrends
      .mockRejectedValueOnce({
        response: { data: { message: "Server Error" } },
      })
      .mockResolvedValueOnce(TRENDS_PAYLOAD);

    renderDashboard({ organization: { _id: "org-123" } });

    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    expect(
      await screen.findByRole("region", {
        name: /composite score trend chart/i,
      }),
    ).toBeInTheDocument();
    expect(meetingHealthApi.getOrganizationHealthTrends).toHaveBeenCalledTimes(
      2,
    );
  });
});
