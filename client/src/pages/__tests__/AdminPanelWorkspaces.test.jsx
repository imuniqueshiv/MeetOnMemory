import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import AdminPanel from "../AdminPanel.jsx";
import { organizationApi, meetingApi, policyApi } from "../../services";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <nav data-testid="shared-navbar">Shared Navbar</nav>,
}));

vi.mock("../../services/statusApi.js", () => ({
  fetchPlatformStatus: vi
    .fn()
    .mockResolvedValue({ ok: true, data: { services: [] } }),
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

describe("AdminPanel Workspaces & Search Filtering (#2040)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders live members workspace and filters by search input", async () => {
    organizationApi.getMembers.mockResolvedValue({
      data: {
        success: true,
        members: [
          {
            _id: "m1",
            user: { name: "Alice Smith", email: "alice@example.com" },
            role: "admin",
          },
          {
            _id: "m2",
            user: { name: "Bob Johnson", email: "bob@example.com" },
            role: "member",
          },
        ],
      },
    });
    organizationApi.getUserOrganizations.mockResolvedValue({
      data: { organizations: [] },
    });
    meetingApi.getAllMeetings.mockResolvedValue({ data: { meetings: [] } });

    render(
      <BrowserRouter>
        <AdminPanel />
      </BrowserRouter>,
    );

    // Click on Members module tab
    const membersTab = screen.getByRole("button", { name: /members/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
      expect(screen.getByTestId("member-search-input")).toBeInTheDocument();
    });

    // Filter by "Alice"
    fireEvent.change(screen.getByTestId("member-search-input"), {
      target: { value: "Alice" },
    });

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Johnson")).not.toBeInTheDocument();
  });

  it("renders meetings workspace and filters by meeting search input", async () => {
    organizationApi.getMembers.mockResolvedValue({ data: { members: [] } });
    organizationApi.getUserOrganizations.mockResolvedValue({
      data: { organizations: [] },
    });
    meetingApi.getAllMeetings.mockResolvedValue({
      data: {
        success: true,
        meetings: [
          {
            _id: "mt1",
            title: "Quarterly Roadmap Review",
            date: "2026-08-20",
            status: "completed",
          },
          {
            _id: "mt2",
            title: "Daily Engineering Standup",
            date: "2026-08-21",
            status: "recorded",
          },
        ],
      },
    });

    render(
      <BrowserRouter>
        <AdminPanel />
      </BrowserRouter>,
    );

    const meetingsTab = screen.getByRole("button", { name: /meetings/i });
    fireEvent.click(meetingsTab);

    await waitFor(() => {
      expect(screen.getByText("Quarterly Roadmap Review")).toBeInTheDocument();
      expect(screen.getByText("Daily Engineering Standup")).toBeInTheDocument();
      expect(screen.getByTestId("meeting-search-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("meeting-search-input"), {
      target: { value: "Roadmap" },
    });

    expect(screen.getByText("Quarterly Roadmap Review")).toBeInTheDocument();
    expect(
      screen.queryByText("Daily Engineering Standup"),
    ).not.toBeInTheDocument();
  });
});
