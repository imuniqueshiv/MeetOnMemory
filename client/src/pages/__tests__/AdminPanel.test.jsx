import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminPanel from "../AdminPanel";
import AppContent from "../../context/AppContent";
import {
  organizationApi,
  meetingApi,
  policyApi,
  membershipRequestApi,
} from "../../services";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../components/admin/TemplateBuilder.jsx", () => ({
  default: () => <div data-testid="template-builder">Template Builder</div>,
}));

vi.mock("../../components/admin/TestimonialsModeration.jsx", () => ({
  default: () => (
    <div data-testid="testimonials-moderation">Testimonials Moderation</div>
  ),
}));

vi.mock("../../components/organization/MembershipRequests.jsx", () => ({
  default: ({ organizationId }) => (
    <div data-testid="membership-requests">
      Membership Requests for {organizationId}
    </div>
  ),
}));

vi.mock("../../services", () => ({
  organizationApi: {
    getMembers: vi.fn(),
    getUserOrganizations: vi.fn(),
    getAuditLogs: vi.fn(),
    getOrganizationSettings: vi.fn(),
  },
  meetingApi: {
    getAllMeetings: vi.fn(),
  },
  policyApi: {
    getPolicies: vi.fn(),
  },
  membershipRequestApi: {
    getOrganizationRequests: vi.fn(),
  },
  analyticsApi: {
    getAnalytics: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

const mockUserData = {
  name: "Admin User",
  role: "admin",
  organization: { _id: "org-123", name: "Test Org" },
};

const renderAdminPanel = (userData = mockUserData) =>
  render(
    <MemoryRouter>
      <AppContent.Provider value={{ userData }}>
        <AdminPanel />
      </AppContent.Provider>
    </MemoryRouter>,
  );

describe("AdminPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    organizationApi.getMembers.mockResolvedValue({
      data: {
        success: true,
        members: [
          {
            _id: "m1",
            user: { name: "Alice", email: "alice@test.com" },
            role: "admin",
          },
          {
            _id: "m2",
            user: { name: "Bob", email: "bob@test.com" },
            role: "member",
          },
        ],
      },
    });
    organizationApi.getUserOrganizations.mockResolvedValue({
      data: {
        success: true,
        organizations: [
          { _id: "org-123", name: "Test Org", slug: "test-org", role: "Owner" },
        ],
      },
    });
    meetingApi.getAllMeetings.mockResolvedValue({
      data: {
        success: true,
        meetings: [
          {
            _id: "mtg-1",
            title: "Sprint Planning",
            date: "2026-08-20T10:00:00Z",
            status: "scheduled",
          },
        ],
      },
    });
    membershipRequestApi.getOrganizationRequests.mockResolvedValue({
      data: {
        success: true,
        requests: [
          { _id: "req-1", user: { name: "Charlie" }, status: "pending" },
        ],
      },
    });
    organizationApi.getAuditLogs.mockResolvedValue({
      data: {
        success: true,
        logs: [
          {
            _id: "log-1",
            action: "MEMBER_INVITED",
            user: { name: "Admin" },
            details: "Invited user",
            createdAt: "2026-08-19T12:00:00Z",
          },
        ],
      },
    });
    policyApi.getPolicies.mockResolvedValue({
      data: {
        success: true,
        policies: [
          {
            _id: "pol-1",
            title: "Security Policy",
            category: "Security",
            version: "1.0",
            status: "Active",
          },
        ],
      },
    });
  });

  it("renders the admin panel title and overview module with live metrics (#1798)", async () => {
    renderAdminPanel();

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getAllByText("adminPanel.title").length).toBeGreaterThan(0);
    expect(screen.getAllByText("adminPanel.overview").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("adminPanel.recentActivity")).toBeInTheDocument();

    await waitFor(() => {
      // Total users: 2
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    // Total meetings: 1, Active orgs: 1, Pending requests: 1
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);

    // Recent activity rendered
    expect(screen.getByText("MEMBER INVITED")).toBeInTheDocument();
  });

  it("renders live members workspace when switching to members module", async () => {
    renderAdminPanel();

    const membersBtn = screen.getByRole("button", {
      name: /adminPanel\.members/i,
    });
    fireEvent.click(membersBtn);

    await waitFor(() => {
      expect(screen.getByText("Members & Roles Directory")).toBeInTheDocument();
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders membership requests component when switching to joinRequests module", async () => {
    renderAdminPanel();

    const joinBtn = screen.getByRole("button", {
      name: /adminPanel\.joinRequests/i,
    });
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByTestId("membership-requests")).toBeInTheDocument();
    });
  });

  it("renders meetings workspace when switching to meetings module", async () => {
    renderAdminPanel();

    const meetingsBtn = screen.getByRole("button", {
      name: /adminPanel\.meetings/i,
    });
    fireEvent.click(meetingsBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Meeting Records & Intelligence Workspace"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
  });

  it("renders policies workspace when switching to policies module", async () => {
    renderAdminPanel();

    const policiesBtn = screen.getByRole("button", {
      name: /adminPanel\.policies/i,
    });
    fireEvent.click(policiesBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Compliance & Policy Repository Workspace"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Security Policy")).toBeInTheDocument();
  });
});
