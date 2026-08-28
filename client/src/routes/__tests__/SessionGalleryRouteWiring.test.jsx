import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes } from "react-router-dom";
import ProtectedRoutes from "../ProtectedRoutes";
import AppContent from "../../context/AppContent";
import { sessionCardApi } from "../../services";

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services", () => ({
  sessionCardApi: {
    getSessionCards: vi.fn(),
    deleteSessionCard: vi.fn(),
  },
}));

describe("SessionGallery Route Wiring (#2437)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRoute = (initialPath = "/session-cards") => {
    sessionCardApi.getSessionCards.mockResolvedValue({
      data: {
        success: true,
        data: {
          sessions: [],
          pagination: { total: 0, page: 1, limit: 24, totalPages: 1 },
        },
      },
    });

    const mockContext = {
      userData: {
        _id: "u_1",
        email: "user@example.com",
        currentOrganization: "org_1",
        hasCompletedOnboarding: true,
      },
      isLoggedin: true,
      role: "admin",
    };

    return render(
      <AppContent.Provider value={mockContext}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>{ProtectedRoutes}</Routes>
        </MemoryRouter>
      </AppContent.Provider>,
    );
  };

  it("successfully resolves and mounts SessionGallery on /session-cards", async () => {
    renderRoute("/session-cards");

    await waitFor(() => {
      expect(
        screen.getByText("Organization Session Cards"),
      ).toBeInTheDocument();
    });
  });

  it("successfully resolves and mounts SessionGallery on /session-gallery alias", async () => {
    renderRoute("/session-gallery");

    await waitFor(() => {
      expect(
        screen.getByText("Organization Session Cards"),
      ).toBeInTheDocument();
    });
  });
});
