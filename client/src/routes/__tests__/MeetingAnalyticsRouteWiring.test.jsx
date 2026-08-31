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

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ orgId: "org_1" }),
  useUser: () => ({ user: { id: "user_1" } }),
}));

vi.mock("../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../../hooks/usePolling.js", () => ({
  usePolling: () => ({
    startPolling: vi.fn(),
  }),
}));

describe("MeetingAnalytics Route Wiring (#2736)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/api/analytics/meetings/")) {
        return Promise.resolve({
          data: {
            meeting: {
              _id: "m_123",
              title: "Sprint Retrospective Q3",
              duration: 3600,
              organization: "org_1",
            },
            status: "completed",
            stats: {
              participantCount: 5,
              totalDurationMinutes: 60,
              speakingDistribution: [],
              sentimentSummary: {},
            },
          },
        });
      }
      if (url.includes("/api/meeting-goals/org/")) {
        return Promise.resolve({
          data: {
            success: true,
            stats: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  const renderRoute = (initialPath = "/meeting/m_123/analytics") => {
    const mockContext = {
      userData: {
        _id: "u_1",
        email: "user@example.com",
        currentOrganization: "org_1",
        role: "admin",
        hasCompletedOnboarding: true,
      },
      isLoggedin: true,
    };

    return render(
      <AppContent.Provider value={mockContext}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>{ProtectedRoutes}</Routes>
        </MemoryRouter>
      </AppContent.Provider>,
    );
  };

  it("successfully mounts MeetingAnalytics on /meeting/:id/analytics within ProtectedRoutes", async () => {
    renderRoute("/meeting/m_123/analytics");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Meeting Analytics" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Sprint Retrospective Q3/i)).toBeInTheDocument();
    });
  });

  it("successfully mounts MeetingAnalytics on alias /meetings/:meetingId/analytics", async () => {
    renderRoute("/meetings/m_123/analytics");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Meeting Analytics" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Sprint Retrospective Q3/i)).toBeInTheDocument();
    });
  });

  it("successfully mounts MeetingAnalytics on alias /analytics/meetings/:meetingId", async () => {
    renderRoute("/analytics/meetings/m_123");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Meeting Analytics" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Sprint Retrospective Q3/i)).toBeInTheDocument();
    });
  });
});
