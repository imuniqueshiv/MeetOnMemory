import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes } from "react-router-dom";
import ProtectedRoutes from "../ProtectedRoutes";
import AppContent from "../../context/AppContent";
import apiClient from "../../services/apiClient";

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe("LanguagePreferences Route Wiring (#2438)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((url) => {
      if (url === "/api/translations/preferences") {
        return Promise.resolve({
          data: {
            preferences: {
              autoTranslate: true,
              showConfidenceScores: true,
              preferredProvider: "auto",
              defaultSourceLanguage: "en",
              defaultTargetLanguages: ["es"],
              customGlossary: [],
            },
          },
        });
      }
      if (url === "/api/translations/languages") {
        return Promise.resolve({
          data: { languages: [{ code: "en", name: "English" }] },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  const renderRoute = (initialPath = "/settings/language") => {
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

  it("successfully mounts LanguagePreferences on /settings/language", async () => {
    renderRoute("/settings/language");

    await waitFor(() => {
      expect(screen.getByText("Language Preferences")).toBeInTheDocument();
    });
  });

  it("successfully mounts LanguagePreferences on /language-preferences alias", async () => {
    renderRoute("/language-preferences");

    await waitFor(() => {
      expect(screen.getByText("Language Preferences")).toBeInTheDocument();
    });
  });
});
