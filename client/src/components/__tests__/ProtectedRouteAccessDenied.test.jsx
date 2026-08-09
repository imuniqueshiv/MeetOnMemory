import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppContent from "../../context/AppContent.js";
import ProtectedRoute from "../ProtectedRoute.jsx";

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe("ProtectedRoute Access Denied Display (#1130)", () => {
  it("renders AccessDenied page instead of silent redirect when permission is denied", () => {
    const mockContext = {
      isLoggedin: true,
      userData: { name: "Unauthorized User", hasCompletedOnboarding: true },
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={["/admin/audit-logs"]}>
        <AppContent.Provider value={mockContext}>
          <ProtectedRoute resource="audit_logs" action="view">
            <div data-testid="protected-content">Secret Content</div>
          </ProtectedRoute>
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByText("accessDenied.title")).toBeInTheDocument();
    expect(screen.getByText("accessDenied.description")).toBeInTheDocument();
  });
});
