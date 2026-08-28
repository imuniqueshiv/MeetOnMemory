import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OrganizationSettings from "../OrganizationSettings.jsx";
import AppContent from "../../context/AppContent";
import { organizationApi } from "../../services/organizationApi.js";
import { customFieldApi } from "../../api/customFieldApi";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("../../services/organizationApi.js", () => ({
  organizationApi: {
    getOrganizationSettings: vi.fn(),
    updateOrganizationSettings: vi.fn(),
  },
}));

vi.mock("../../api/customFieldApi", () => ({
  customFieldApi: {
    getDefinitions: vi.fn(),
    createDefinition: vi.fn(),
    updateDefinition: vi.fn(),
    deleteDefinition: vi.fn(),
  },
}));

vi.mock("../../components/integrations/NotionConnectPanel.jsx", () => ({
  default: () => null,
}));

vi.mock("../../components/integrations/GitHubConnectPanel.jsx", () => ({
  default: () => null,
}));

vi.mock("../../components/integrations/IssueTrackerConfig.jsx", () => ({
  default: () => null,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const renderSettings = () =>
  render(
    <MemoryRouter>
      <AppContent.Provider
        value={{ getUserData: vi.fn(), setUserData: vi.fn() }}
      >
        <OrganizationSettings />
      </AppContent.Provider>
    </MemoryRouter>,
  );

describe("OrganizationSettings custom fields visibility (#1903)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customFieldApi.getDefinitions.mockResolvedValue({ data: [] });
  });

  it("shows the Custom Fields section to organization administrators", async () => {
    organizationApi.getOrganizationSettings.mockResolvedValue({
      data: {
        success: true,
        canEdit: true,
        userRole: "admin",
        organization: {
          _id: "org-admin",
          name: "Acme Corp",
        },
      },
    });

    renderSettings();

    expect(
      await screen.findByRole("heading", { name: /custom fields/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(customFieldApi.getDefinitions).toHaveBeenCalledWith("org-admin", {
        includeInactive: true,
      });
    });
  });

  it("hides the Custom Fields section from non-admin members", async () => {
    organizationApi.getOrganizationSettings.mockResolvedValue({
      data: {
        success: true,
        canEdit: false,
        userRole: "member",
        organization: {
          _id: "org-member",
          name: "Acme Corp",
        },
      },
    });

    renderSettings();

    await screen.findByRole("heading", { name: /organization settings/i });
    expect(
      screen.queryByRole("heading", { name: /^custom fields$/i }),
    ).not.toBeInTheDocument();
    expect(customFieldApi.getDefinitions).not.toHaveBeenCalled();
  });
});
