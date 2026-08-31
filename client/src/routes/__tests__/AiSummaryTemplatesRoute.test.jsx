import React from "react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import AppContent from "../../context/AppContent.js";

let permissionGranted = true;

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => permissionGranted,
  }),
}));

const renderRoute = ({ isLoggedin, userData, loading = false }) => {
  return render(
    <MemoryRouter initialEntries={["/ai-summary-templates"]}>
      <AppContent.Provider value={{ isLoggedin, userData, loading }}>
        <Routes>
          <Route
            path="/ai-summary-templates"
            element={
              <ProtectedRoute
                resource="admin_panel"
                action="view"
                forbiddenFallback={<div>Access Denied</div>}
              >
                <div>AI Summary Templates</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </AppContent.Provider>
    </MemoryRouter>,
  );
};

describe("AI Summary Templates route protection (#1657)", () => {
  beforeEach(() => {
    permissionGranted = true;
  });

  it("registers the route behind the admin_panel view permission", () => {
    const filePath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../ProtectedRoutes.jsx",
    );
    const source = readFileSync(filePath, "utf8");

    expect(source).toMatch(
      /path="\/ai-summary-templates"[\s\S]*?resource="admin_panel"[\s\S]*?action="view"[\s\S]*?AiSummaryTemplates/,
    );
  });

  it("redirects unauthenticated direct navigation to login", () => {
    renderRoute({
      isLoggedin: false,
      userData: null,
    });

    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.queryByText("AI Summary Templates")).not.toBeInTheDocument();
  });

  it("allows an authenticated user with admin_panel view permission", () => {
    renderRoute({
      isLoggedin: true,
      userData: { hasCompletedOnboarding: true },
    });

    expect(screen.getByText("AI Summary Templates")).toBeInTheDocument();
  });

  it("shows Access Denied when an authenticated user lacks permission", () => {
    permissionGranted = false;

    renderRoute({
      isLoggedin: true,
      userData: { hasCompletedOnboarding: true },
    });

    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.queryByText("AI Summary Templates")).not.toBeInTheDocument();
  });
});
