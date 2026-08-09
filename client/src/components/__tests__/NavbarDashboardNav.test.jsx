import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Navbar from "../Navbar.jsx";
import AppContent from "../../context/AppContent.js";
import { ThemeContext } from "../../context/ThemeContext.jsx";

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: (resource, action) => {
      // User has no reports:view permission
      if (resource === "reports" && action === "view") return false;
      return true;
    },
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => {
      if (key === "navbar.dashboard") return "Dashboard";
      if (key === "navbar.meetings") return "Meetings";
      return key;
    },
    i18n: {
      language: "en",
      changeLanguage: vi.fn(),
    },
  }),
}));

describe("Navbar Dashboard Navigation Visibility (#1127)", () => {
  it("renders Dashboard navigation item for logged-in users regardless of reports:view permission", () => {
    const mockContextValue = {
      isLoggedin: true,
      userData: {
        name: "Test User",
        email: "user@example.com",
        role: "member",
      },
      setUserData: vi.fn(),
      setIsLoggedin: vi.fn(),
      backendUrl: "http://localhost:4000",
    };

    const mockThemeContext = {
      theme: "light",
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
      mounted: true,
    };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ThemeContext.Provider value={mockThemeContext}>
          <AppContent.Provider value={mockContextValue}>
            <Navbar />
          </AppContent.Provider>
        </ThemeContext.Provider>
      </MemoryRouter>,
    );

    const dashboardElements = screen.getAllByText("Dashboard");
    expect(dashboardElements.length).toBeGreaterThan(0);
  });
});
