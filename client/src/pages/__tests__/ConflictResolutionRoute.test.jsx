import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AppContent from "../../context/AppContent.js";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import ConflictResolution from "../ConflictResolution.jsx";

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("../ConflictResolution.jsx", () => ({
  default: () => (
    <div data-testid="conflict-resolution-page">Conflict Resolution Page</div>
  ),
}));

describe("Conflict Resolution Route Registration (#1128)", () => {
  it("resolves /knowledge/conflicts route correctly to ConflictResolution component", () => {
    const mockContext = {
      isLoggedin: true,
      userData: { name: "Test User", hasCompletedOnboarding: true },
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={["/knowledge/conflicts"]}>
        <AppContent.Provider value={mockContext}>
          <Routes>
            <Route
              path="/knowledge/conflicts"
              element={
                <ProtectedRoute resource="knowledge" action="view">
                  <ConflictResolution />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge/:decisionId"
              element={<div>Dynamic Decision Page</div>}
            />
          </Routes>
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("conflict-resolution-page")).toBeInTheDocument();
    expect(screen.queryByText("Dynamic Decision Page")).not.toBeInTheDocument();
  });
});
