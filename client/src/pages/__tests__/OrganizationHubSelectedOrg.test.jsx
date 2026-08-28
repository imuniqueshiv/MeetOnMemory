import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OrganizationHub from "../OrganizationHub.jsx";
import { organizationApi } from "../../services";
import AppContent from "../../context/AppContent";

vi.mock("../../services", () => ({
  organizationApi: {
    getUserOrganizations: vi.fn(),
  },
}));

vi.mock("../../components/Navbar", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../components/organization/TopContributorsWidget", () => ({
  default: ({ organizationId }) => (
    <div data-testid="top-contributors-widget" data-orgid={organizationId}>
      TopContributors: {organizationId}
    </div>
  ),
}));

vi.mock("../../components/organization/ParkingLotBacklog", () => ({
  default: ({ organizationId }) => (
    <div data-testid="parking-lot-backlog" data-orgid={organizationId}>
      ParkingLot: {organizationId}
    </div>
  ),
}));

describe("OrganizationHub Selected Org Wiring (#2008)", () => {
  const mockOrgs = [
    { _id: "org-1", name: "Primary Org", role: "member" },
    { _id: "org-2", name: "Secondary Org", role: "admin" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses active userData.organization as selected organization in widgets", async () => {
    organizationApi.getUserOrganizations.mockResolvedValue({
      data: { success: true, organizations: mockOrgs },
    });

    const mockUserData = {
      _id: "user-1",
      organization: { _id: "org-2", name: "Secondary Org" },
    };

    render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: mockUserData }}>
          <OrganizationHub />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const topContributors = screen.getByTestId("top-contributors-widget");
      expect(topContributors.getAttribute("data-orgid")).toBe("org-2");
      const parkingLot = screen.getByTestId("parking-lot-backlog");
      expect(parkingLot.getAttribute("data-orgid")).toBe("org-2");
    });
  });

  it("allows switching active organization from dropdown", async () => {
    organizationApi.getUserOrganizations.mockResolvedValue({
      data: { success: true, organizations: mockOrgs },
    });

    const mockUserData = {
      _id: "user-1",
      organization: { _id: "org-1", name: "Primary Org" },
    };

    render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: mockUserData }}>
          <OrganizationHub />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Select organization for engagement metrics/i),
      ).toBeInTheDocument();
    });

    const select = screen.getByLabelText(
      /Select organization for engagement metrics/i,
    );
    fireEvent.change(select, { target: { value: "org-2" } });

    await waitFor(() => {
      const topContributors = screen.getByTestId("top-contributors-widget");
      expect(topContributors.getAttribute("data-orgid")).toBe("org-2");
    });
  });

  it("renders empty state when user has no organizations", async () => {
    organizationApi.getUserOrganizations.mockResolvedValue({
      data: { success: true, organizations: [] },
    });

    render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: null }}>
          <OrganizationHub />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/No Organizations Yet/i)).toBeInTheDocument();
    });
  });
});
