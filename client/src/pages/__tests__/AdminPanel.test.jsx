import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppContent from "../../context/AppContent";
import AdminPanel from "../AdminPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar-mock">Navbar</div>,
}));

const mockUserData = {
  name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  organization: { name: "Test Org", _id: "org1" },
};

const renderWithProviders = (userData = mockUserData) => {
  return render(
    <MemoryRouter>
      <AppContent.Provider value={{ userData }}>
        <AdminPanel />
      </AppContent.Provider>
    </MemoryRouter>,
  );
};

describe("AdminPanel", () => {
  it("renders the Navbar", () => {
    renderWithProviders();
    expect(screen.getByTestId("navbar-mock")).toBeInTheDocument();
  });

  it("renders the sidebar with all module items", () => {
    renderWithProviders();
    expect(screen.getAllByText("adminPanel.overview").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("adminPanel.organizations")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.members")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.joinRequests")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.meetings")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.policies")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.reports")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.settings")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.activity")).toBeInTheDocument();
  });

  it("shows Dashboard Overview as the default active module", () => {
    renderWithProviders();
    expect(screen.getByText("adminPanel.overviewDesc")).toBeInTheDocument();
  });

  it("shows stat cards in the overview", () => {
    renderWithProviders();
    expect(screen.getByText("adminPanel.totalUsers")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.activeOrgs")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.totalMeetings")).toBeInTheDocument();
    expect(screen.getByText("adminPanel.pendingRequests")).toBeInTheDocument();
  });

  it("switches active module when clicking a sidebar item", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("adminPanel.organizations"));
    expect(screen.getAllByText("adminPanel.organizationsDesc").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByText("adminPanel.members"));
    expect(screen.getAllByText("adminPanel.membersDesc").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Coming Soon' badge for non-overview modules", () => {
    renderWithProviders();
    fireEvent.click(screen.getByText("adminPanel.organizations"));
    expect(screen.getByText("adminPanel.comingSoon")).toBeInTheDocument();
  });

  it("renders the admin panel title in the sidebar header", () => {
    renderWithProviders();
    expect(screen.getByText("adminPanel.title")).toBeInTheDocument();
  });
});
