import React from "react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import AppContent from "../../context/AppContent.js";

let mockPermissions = {};

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: (resource, action) => {
      const key = `${resource}:${action}`;
      return mockPermissions[key] ?? true;
    },
  }),
}));

describe("RBAC Client Route Guard Prototyping (#2653)", () => {
  beforeEach(() => {
    mockPermissions = {};
  });

  const renderProtectedComponent = (
    initialPath,
    resource,
    action,
    content,
    userData = { hasCompletedOnboarding: true, role: "member" },
  ) => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AppContent.Provider
          value={{ isLoggedin: true, userData, loading: false }}
        >
          <Routes>
            <Route
              path={initialPath}
              element={
                <ProtectedRoute
                  resource={resource}
                  action={action}
                  forbiddenFallback={
                    <div data-testid="access-denied">Access Denied</div>
                  }
                >
                  <div data-testid="protected-content">{content}</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AppContent.Provider>
      </MemoryRouter>,
    );
  };

  it("blocks unauthorized users trying to access dlp-compliance paths", () => {
    mockPermissions["admin_panel:view"] = false;

    renderProtectedComponent(
      "/dlp-compliance",
      "admin_panel",
      "view",
      "Sensitive Audit Log",
    );

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-denied")).toBeInTheDocument();
  });

  it("blocks unauthorized users from accessing escalations when tasks view permission is missing", () => {
    mockPermissions["tasks:view"] = false;

    renderProtectedComponent(
      "/escalations",
      "tasks",
      "view",
      "Escalations Dashboard Content",
    );

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-denied")).toBeInTheDocument();
  });

  it("allows authorized users to access bookmarks route", () => {
    mockPermissions["bookmarks:view"] = true;

    renderProtectedComponent(
      "/bookmarks",
      "bookmarks",
      "view",
      "My Bookmarks List",
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByText("My Bookmarks List")).toBeInTheDocument();
  });

  it("allows authorized users to access focus-time route", () => {
    mockPermissions["reports:view"] = true;

    renderProtectedComponent(
      "/focus-time",
      "reports",
      "view",
      "Focus Time Analytics",
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByText("Focus Time Analytics")).toBeInTheDocument();
  });

  it("declares explicit RBAC resource and action props on sensitive routes in ProtectedRoutes.jsx", () => {
    const filePath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../ProtectedRoutes.jsx",
    );
    const source = readFileSync(filePath, "utf8");

    // Assert that sensitive routes have explicit resource and action props
    expect(source).toMatch(
      /path="\/escalations"[\s\S]*?resource="tasks"[\s\S]*?action="view"/,
    );
    expect(source).toMatch(
      /path="\/focus-time"[\s\S]*?resource="reports"[\s\S]*?action="view"/,
    );
    expect(source).toMatch(
      /path="\/bookmarks"[\s\S]*?resource="bookmarks"[\s\S]*?action="view"/,
    );
    expect(source).toMatch(
      /path="\/dlp-compliance"[\s\S]*?resource="admin_panel"[\s\S]*?action="view"/,
    );
    expect(source).toMatch(
      /path="\/compliance\/dlp"[\s\S]*?resource="admin_panel"[\s\S]*?action="view"/,
    );
    expect(source).toMatch(
      /path="\/settings"[\s\S]*?resource="settings"[\s\S]*?action="self_view"/,
    );
    expect(source).toMatch(
      /path="\/profile"[\s\S]*?resource="settings"[\s\S]*?action="self_view"/,
    );
  });
});
