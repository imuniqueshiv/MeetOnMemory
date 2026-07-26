import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";
import AppContent from "../../context/AppContent";
import * as useRBACHook from "../../hooks/useRBAC";

// Mock the useRBAC hook
vi.mock("../../hooks/useRBAC", () => ({
  useRBAC: vi.fn(),
}));

// Helper component to check current route
const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

const renderWithProviders = (ui, contextValue, initialRoute = "/") => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppContent.Provider value={contextValue}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/login" element={<LocationDisplay />} />
          <Route path="/organizations" element={<LocationDisplay />} />
          <Route path="/dashboard" element={<LocationDisplay />} />
        </Routes>
      </AppContent.Provider>
    </MemoryRouter>,
  );
};

describe("ProtectedRoute", () => {
  it("shows loading state when isLoading is true", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { isLoading: true, isLoggedin: false, userData: null },
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to login if user is not logged in", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { isLoading: false, isLoggedin: false, userData: null },
    );

    expect(screen.getByTestId("location-display")).toHaveTextContent("/login");
  });

  it("redirects to login when logged in but user data is missing", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { loading: false, isLoggedin: true, userData: null },
    );

    expect(screen.getByTestId("location-display")).toHaveTextContent("/login");
  });

  it("redirects to /organizations if onboarding is not completed and not on an onboarding page", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        isLoading: false,
        isLoggedin: true,
        userData: { hasCompletedOnboarding: false },
      },
      "/",
    );

    expect(screen.getByTestId("location-display")).toHaveTextContent(
      "/organizations",
    );
  });

  it("redirects to /dashboard if onboarding is completed but user is on an onboarding page", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/organizations"]}>
        <AppContent.Provider
          value={{
            isLoading: false,
            isLoggedin: true,
            userData: { hasCompletedOnboarding: true },
          }}
        >
          <Routes>
            <Route
              path="/organizations"
              element={
                <ProtectedRoute>
                  <div>Onboarding Page</div>
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard" element={<LocationDisplay />} />
          </Routes>
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location-display")).toHaveTextContent(
      "/dashboard",
    );
  });

  it("redirects to dashboard if user lacks required RBAC permissions", () => {
    const mockHasPermission = vi.fn().mockReturnValue(false);
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: mockHasPermission,
    });

    renderWithProviders(
      <ProtectedRoute resource="meetings" action="delete">
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        isLoading: false,
        isLoggedin: true,
        userData: { hasCompletedOnboarding: true },
      },
    );

    expect(mockHasPermission).toHaveBeenCalledWith("meetings", "delete");
    expect(screen.getByTestId("location-display")).toHaveTextContent(
      "/dashboard",
    );
  });

  it("renders children if user has required permissions", () => {
    const mockHasPermission = vi.fn().mockReturnValue(true);
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: mockHasPermission,
    });

    renderWithProviders(
      <ProtectedRoute resource="meetings" action="view">
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        isLoading: false,
        isLoggedin: true,
        userData: { hasCompletedOnboarding: true },
      },
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("renders forbiddenFallback when permission is denied", () => {
    const mockHasPermission = vi.fn().mockReturnValue(false);
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: mockHasPermission,
    });

    renderWithProviders(
      <ProtectedRoute
        resource="admin_panel"
        action="view"
        forbiddenFallback={<div>Access Denied Page</div>}
      >
        <div>Admin Content</div>
      </ProtectedRoute>,
      {
        isLoading: false,
        isLoggedin: true,
        userData: { hasCompletedOnboarding: true },
      },
    );

    expect(screen.getByText("Access Denied Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });
});
