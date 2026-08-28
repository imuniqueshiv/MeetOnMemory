import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AcceptInvite from "../AcceptInvite";
import AppContent from "../../context/AppContent";
import { invitationApi, organizationApi } from "../../services";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("../../services", () => ({
  invitationApi: {
    getInvitationByToken: vi.fn(),
    acceptInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
  },
  organizationApi: {
    acceptInviteToken: vi.fn(),
  },
}));

describe("AcceptInvite Onboarding Component (#2258)", () => {
  const mockValidInvite = {
    _id: "inv-123",
    role: "member",
    status: "pending",
    email: "user@example.com",
    message: "Welcome to the Engineering team!",
    organization: {
      _id: "org-1",
      name: "Acme Corp",
      slug: "acme-corp",
      description: "Building next-generation intelligent tools",
      logo: "https://example.com/logo.png",
    },
    invitedBy: {
      name: "Jane Smith",
      email: "jane@acme.com",
    },
  };

  const renderComponent = (
    token = "valid-token-123",
    contextValue = {
      isLoggedin: true,
      userData: { email: "user@example.com", name: "User" },
      getUserData: vi.fn().mockResolvedValue({ email: "user@example.com" }),
    },
  ) => {
    return render(
      <AppContent.Provider value={contextValue}>
        <MemoryRouter initialEntries={[`/invite/${token}`]}>
          <Routes>
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route
              path="/login"
              element={<div data-testid="login-page">Login Page</div>}
            />
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard-page">Dashboard</div>}
            />
            <Route
              path="/meetings"
              element={<div data-testid="meetings-page">Meetings</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppContent.Provider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders rich organization preview, inviter info, and role capabilities for valid tokens", async () => {
    invitationApi.getInvitationByToken.mockResolvedValueOnce({
      data: {
        success: true,
        invitation: mockValidInvite,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    expect(screen.getByText("@acme-corp")).toBeInTheDocument();
    expect(
      screen.getByText("Building next-generation intelligent tools"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(
      screen.getByText('"Welcome to the Engineering team!"'),
    ).toBeInTheDocument();
    expect(screen.getByText("Team Member")).toBeInTheDocument();
    expect(
      screen.getByText(/Schedule and host meetings with AI transcription/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Accept & Join Acme Corp/i)).toBeInTheDocument();
  });

  it("allows an authenticated user to accept the invite and transitions to post-accept guided onboarding", async () => {
    invitationApi.getInvitationByToken.mockResolvedValueOnce({
      data: {
        success: true,
        invitation: mockValidInvite,
      },
    });
    organizationApi.acceptInviteToken.mockResolvedValueOnce({
      data: {
        success: true,
        message: "Joined successfully",
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole("button", {
      name: /Accept & Join Acme Corp/i,
    });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Welcome to Acme Corp!/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Explore Meetings/i)).toBeInTheDocument();
    expect(screen.getByText(/Meet the Team/i)).toBeInTheDocument();
    expect(screen.getByText(/Launch Workspace Dashboard/i)).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login with the return path", async () => {
    invitationApi.getInvitationByToken.mockResolvedValueOnce({
      data: {
        success: true,
        invitation: mockValidInvite,
      },
    });

    renderComponent("valid-token-123", {
      isLoggedin: false,
      userData: null,
      getUserData: vi.fn(),
    });

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole("button", {
      name: /Accept & Join Acme Corp/i,
    });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
  });

  it("renders expired invitation state with clear recovery options", async () => {
    invitationApi.getInvitationByToken.mockRejectedValueOnce({
      response: {
        data: {
          success: false,
          message: "Invitation has expired.",
        },
      },
    });

    renderComponent("expired-token-123");

    await waitFor(() => {
      expect(screen.getByText("Invitation Expired")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /This invitation link has expired for security reasons/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Request New Invite via Email/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Browse Public Organizations/i),
    ).toBeInTheDocument();
  });

  it("renders invalid / 404 token error state with recovery options", async () => {
    invitationApi.getInvitationByToken.mockRejectedValueOnce({
      response: {
        data: {
          success: false,
          message: "Invitation not found.",
        },
      },
    });

    renderComponent("invalid-token-123");

    await waitFor(() => {
      expect(screen.getByText("Invitation Error")).toBeInTheDocument();
    });

    expect(screen.getByText("Invitation not found.")).toBeInTheDocument();
    expect(screen.getByText("Retry Verification")).toBeInTheDocument();
    expect(screen.getByText("Return to Homepage")).toBeInTheDocument();
  });
});
