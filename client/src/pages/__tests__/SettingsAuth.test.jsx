import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AppContent from "../../context/AppContent.js";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import Settings from "../Settings.jsx";

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: (resource) => {
      // User has no admin settings:view permission
      if (resource === "settings") return false;
      return true;
    },
  }),
}));

vi.mock("../Settings.jsx", () => ({
  default: () => <div data-testid="settings-page">Personal Settings Page</div>,
}));

describe("Settings Page Authorization Alignment (#1129)", () => {
  it("allows regular authenticated users to access personal /settings", () => {
    const mockContext = {
      isLoggedin: true,
      userData: {
        name: "Regular User",
        role: "member",
        hasCompletedOnboarding: true,
      },
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppContent.Provider value={mockContext}>
          <Routes>
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
  });
});
