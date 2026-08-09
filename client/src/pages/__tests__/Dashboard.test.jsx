import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppContent from "../../context/AppContent";
import { RBACProvider } from "../../context/RBACContext.jsx";
import Dashboard from "../Dashboard";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../components/organization/TopContributorsWidget", () => ({
  default: () => <div data-testid="top-contributors">Top Contributors</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

const renderDashboard = (userData) =>
  render(
    <MemoryRouter>
      <AppContent.Provider value={{ userData }}>
        <RBACProvider userRole={userData?.role || null}>
          <Dashboard />
        </RBACProvider>
      </AppContent.Provider>
    </MemoryRouter>,
  );

describe("Dashboard", () => {
  const mockUserData = {
    name: "Alice",
    role: "admin",
    organization: { name: "MeetOnMemory", _id: "org-1" },
  };

  it("renders without throwing", () => {
    renderDashboard(mockUserData);

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByLabelText("Dashboard hero")).toBeInTheDocument();
    expect(screen.getByTestId("feature-cards-grid")).toBeInTheDocument();
  });

  it("renders all seven admin feature cards in a plain CSS grid (#712)", async () => {
    const { container } = renderDashboard(mockUserData);

    await waitFor(() => {
      expect(screen.getByText("dashboard.uploadMeetings")).toBeInTheDocument();
    });

    expect(screen.getByText("dashboard.meetingEventHub")).toBeInTheDocument();
    expect(screen.getByText("dashboard.aiSummarization")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.policiesRepository"),
    ).toBeInTheDocument();
    expect(screen.getByText("dashboard.reportsAnalytics")).toBeInTheDocument();

    expect(screen.getByText("Attendance Analytics")).toBeInTheDocument();
    expect(screen.getByText("Meeting Cost Analytics")).toBeInTheDocument();

    expect(
      container.querySelectorAll(".dash-card").length,
    ).toBeGreaterThanOrEqual(6);
    expect(
      screen.queryByText(/Drag cards to reorder/i),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("top-contributors")).toBeInTheDocument();
  });

  it("hides admin-only cards for non-admin members", () => {
    renderDashboard({
      name: "Bob",
      role: "member",
      organization: { name: "MeetOnMemory", _id: "org-1" },
    });

    // Members have meetings:create — upload/create cards remain visible.
    expect(screen.getByText("dashboard.uploadMeetings")).toBeInTheDocument();
    expect(screen.getByText("dashboard.meetingEventHub")).toBeInTheDocument();
    expect(screen.getByText("dashboard.aiSummarization")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.policiesRepository"),
    ).toBeInTheDocument();
    expect(screen.getByText("dashboard.reportsAnalytics")).toBeInTheDocument();
    expect(screen.getByText("Attendance Analytics")).toBeInTheDocument();
    expect(
      screen.queryByText("Meeting Cost Analytics"),
    ).not.toBeInTheDocument();
  });

  it("treats ADMIN role case-insensitively so all admin cards show", () => {
    renderDashboard({
      name: "Shiv",
      role: "ADMIN",
      organization: { name: "MeetOnMemory", _id: "org-1" },
    });

    // meetings:create uses exact role keys from the permission map.
    expect(
      screen.queryByText("dashboard.uploadMeetings"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("dashboard.meetingEventHub"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("dashboard.aiSummarization")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.policiesRepository"),
    ).toBeInTheDocument();
    expect(screen.getByText("dashboard.reportsAnalytics")).toBeInTheDocument();
    expect(screen.getByText("Attendance Analytics")).toBeInTheDocument();
    // adminOnly cost card still matches role case-insensitively.
    expect(screen.getByText("Meeting Cost Analytics")).toBeInTheDocument();
  });
});
