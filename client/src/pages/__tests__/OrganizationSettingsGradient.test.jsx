import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OrganizationSettings from "../OrganizationSettings.jsx";
import AppContent from "../../context/AppContent";
import { organizationApi } from "../../services/organizationApi.js";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("../../services/organizationApi.js", () => ({
  organizationApi: {
    getOrganizationSettings: vi.fn(),
    updateOrganizationSettings: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("OrganizationSettings Gradient Styling (#1663)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with valid base gradient and light/dark gradient stop classes on loaded state", async () => {
    organizationApi.getOrganizationSettings.mockResolvedValue({
      data: {
        success: true,
        data: {
          name: "Acme Corp",
          description: "Sample description",
          role: "owner",
        },
      },
    });

    const { container, findByText } = render(
      <MemoryRouter>
        <AppContent.Provider
          value={{ getUserData: vi.fn(), setUserData: vi.fn() }}
        >
          <OrganizationSettings />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    await findByText("Organization Settings");

    const root = container.firstChild;
    expect(root.className).toContain("bg-gradient-to-b");
    expect(root.className).toContain("from-slate-50");
    expect(root.className).toContain("via-white");
    expect(root.className).toContain("to-slate-50");
    expect(root.className).toContain("dark:from-slate-950");
    expect(root.className).toContain("dark:via-slate-900");
    expect(root.className).toContain("dark:to-slate-950");
  });
});
