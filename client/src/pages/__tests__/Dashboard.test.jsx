import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppContent from "../../context/AppContent";
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

describe("Dashboard", () => {
  const mockUserData = {
    name: "Alice",
    role: "admin",
    organization: { name: "MeetOnMemory", _id: "org-1" },
  };

  it("renders without throwing", () => {
    render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: mockUserData }}>
          <Dashboard />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByLabelText("Dashboard hero")).toBeInTheDocument();
    expect(screen.getByTestId("feature-cards-grid")).toBeInTheDocument();
  });

  it("renders all six admin feature cards in a plain CSS grid (#712)", async () => {
    const { container } = render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: mockUserData }}>
          <Dashboard />
        </AppContent.Provider>
      </MemoryRouter>,
    );

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

    expect(container.querySelectorAll(".dash-card").length).toBe(6);
    expect(
      screen.queryByText(/Drag cards to reorder/i),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("top-contributors")).toBeInTheDocument();
  });

  it("hides admin-only cards for non-admin members", () => {
    render(
      <MemoryRouter>
        <AppContent.Provider
          value={{
            userData: {
              name: "Bob",
              role: "member",
              organization: { name: "MeetOnMemory", _id: "org-1" },
            },
          }}
        >
          <Dashboard />
        </AppContent.Provider>
      </MemoryRouter>,
    );

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
  });

  it("treats ADMIN role case-insensitively so all six cards show", () => {
    render(
      <MemoryRouter>
        <AppContent.Provider
          value={{
            userData: {
              name: "Shiv",
              role: "ADMIN",
              organization: { name: "MeetOnMemory", _id: "org-1" },
            },
          }}
        >
          <Dashboard />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("dashboard.uploadMeetings")).toBeInTheDocument();
    expect(screen.getByText("dashboard.meetingEventHub")).toBeInTheDocument();
    expect(screen.getByText("dashboard.aiSummarization")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.policiesRepository"),
    ).toBeInTheDocument();
    expect(screen.getByText("dashboard.reportsAnalytics")).toBeInTheDocument();
    expect(screen.getByText("Attendance Analytics")).toBeInTheDocument();
  });
});
