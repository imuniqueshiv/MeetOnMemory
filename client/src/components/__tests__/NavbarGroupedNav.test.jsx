import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Navbar from "../Navbar.jsx";
import AppContent from "../../context/AppContent";
import { RBACProvider } from "../../context/RBACContext.jsx";
import { ThemeContext } from "../../context/ThemeContext.jsx";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/dashboard" }),
  };
});

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    user: { primaryEmailAddress: { emailAddress: "alice@example.com" } },
  }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("../../context/usePreferences.jsx", () => ({
  default: () => ({ dateFormat: "MM/dd/yyyy" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        "navbar.dashboard": "Dashboard",
        "navbar.meetings": "Meetings",
        "navbar.workspace": "Workspace",
        "navbar.insights": "Insights",
        "navbar.knowledge": "Knowledge",
        "navbar.admin": "Admin",
        "navbar.attendanceAnalytics": "Attendance Analytics",
        "navbar.costAnalytics": "Meeting Cost Analytics",
        "navbar.meetingHealth": "Meeting Health",
        "navbar.speakingTime": "Speaking Time Trends",
        "navbar.topicExplorer": "Topic Explorer",
        "navbar.actionItemAnalytics": "Action Item Analytics",
        "navbar.knowledgeGraph": "Knowledge Graph",
        "navbar.decisionGraph": "Decision Graph",
        "navbar.decisionLog": "Decision Log",
        "navbar.memoryLifecycle": "Memory Lifecycle",
        "navbar.glossary": "Glossary",
        "navbar.tasks": "Tasks",
        "navbar.actionItems": "Action Items",
        "navbar.followups": "Follow-ups",
        "navbar.workloadBalance": "Workload Balance",
        "navbar.bookmarks": "Bookmarks",
        "navbar.automationRules": "Automation Rules",
        "navbar.adminPanel": "Admin Panel",
        "navbar.openMenu": "Open menu",
        "navbar.closeMenu": "Close menu",
        "navbar.notifications": "Notifications",
        "navbar.myProfile": "My Profile",
        "navbar.settings": "Settings",
        "navbar.logout": "Logout",
        "navbar.parkingLot": "Parking Lot",
        "navbar.meetingSeries": "Meeting Series",
        "navbar.meetingTemplates": "Meeting Templates",
        "navbar.compareMeetings": "Compare Meetings",
        "navbar.recycleBin": "Recycle Bin",
      };
      return translations[key] || key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

vi.mock("../../services", () => ({
  notificationApi: {
    getUnreadCount: vi
      .fn()
      .mockResolvedValue({ data: { success: true, unreadCount: 0 } }),
    getNotifications: vi
      .fn()
      .mockResolvedValue({ data: { success: true, notifications: [] } }),
    markAsRead: vi.fn(),
  },
  authApi: {
    logout: vi.fn(),
  },
  organizationApi: {
    getUserOrganizations: vi.fn().mockResolvedValue({
      data: { success: true, organizations: [] },
    }),
    selectOrganization: vi.fn(),
  },
}));

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

const mockThemeContext = {
  theme: "light",
  toggleTheme: vi.fn(),
  setTheme: vi.fn(),
  mounted: true,
};

const renderNavbar = (userRole = "admin") => {
  const mockContextValue = {
    isLoggedin: true,
    userData: {
      _id: "u123",
      name: "Alice Admin",
      email: "alice@example.com",
      role: userRole,
      organization: { _id: "org1", name: "Acme Corp" },
    },
    setUserData: vi.fn(),
    setIsLoggedin: vi.fn(),
    backendUrl: "http://localhost:4000",
  };

  return render(
    <BrowserRouter>
      <ThemeContext.Provider value={mockThemeContext}>
        <RBACProvider userRole={userRole}>
          <AppContent.Provider value={mockContextValue}>
            <Navbar />
          </AppContent.Provider>
        </RBACProvider>
      </ThemeContext.Provider>
    </BrowserRouter>,
  );
};

describe("Navbar Grouped Navigation & Feature Route Discovery (#2024)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Dashboard and primary navigation group buttons for admin", () => {
    renderNavbar("admin");

    expect(
      screen.getByRole("button", { name: /^dashboard$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /meetings menu/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /workspace menu/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /insights menu/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /knowledge menu/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /admin menu/i }),
    ).toBeInTheDocument();
  });

  it("opens Meetings dropdown and includes the parking lot backlog route", async () => {
    renderNavbar("admin");

    fireEvent.click(screen.getByRole("button", { name: /meetings menu/i }));

    expect(
      screen.getByRole("menu", { name: /meetings sub-navigation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /parking lot/i }),
    ).toBeInTheDocument();
  });

  it("opens Insights dropdown and shows key analytics routes", async () => {
    renderNavbar("admin");

    const insightsBtn = screen.getByRole("button", { name: /insights menu/i });
    fireEvent.click(insightsBtn);

    expect(
      screen.getByRole("menu", { name: /insights sub-navigation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /attendance analytics/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /meeting cost analytics/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /meeting health/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /speaking time trends/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /topic explorer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /action item analytics/i }),
    ).toBeInTheDocument();
  });

  it("navigates to selected route on dropdown item click and closes dropdown", async () => {
    renderNavbar("admin");

    const insightsBtn = screen.getByRole("button", { name: /insights menu/i });
    fireEvent.click(insightsBtn);

    const attendanceItem = screen.getByRole("menuitem", {
      name: /attendance analytics/i,
    });
    fireEvent.click(attendanceItem);

    expect(mockNavigate).toHaveBeenCalledWith("/attendance-analytics");
    expect(
      screen.queryByRole("menu", { name: /insights sub-navigation/i }),
    ).not.toBeInTheDocument();
  });

  it("opens Knowledge dropdown and displays graph, decisions, lifecycle, and archive", async () => {
    renderNavbar("admin");

    const knowledgeBtn = screen.getByRole("button", {
      name: /knowledge menu/i,
    });
    fireEvent.click(knowledgeBtn);

    expect(
      screen.getByRole("menu", { name: /knowledge sub-navigation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /knowledge graph/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /decision graph/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /decision log/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /memory lifecycle/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /glossary/i }),
    ).toBeInTheDocument();
  });

  it("opens Workspace dropdown and displays tasks, action items, calendar, and bookmarks", async () => {
    renderNavbar("admin");

    const workspaceBtn = screen.getByRole("button", {
      name: /workspace menu/i,
    });
    fireEvent.click(workspaceBtn);

    expect(
      screen.getByRole("menu", { name: /workspace sub-navigation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /action items/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /follow-ups/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /workload balance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /bookmarks/i }),
    ).toBeInTheDocument();
  });

  it("hides restricted admin/automation links for guest users (RBAC filtering)", () => {
    renderNavbar("guest");

    // Open Admin dropdown for guest
    const adminBtn = screen.getByRole("button", { name: /admin menu/i });
    fireEvent.click(adminBtn);

    // Guest does NOT have automation_rules:view or admin_panel:view permissions
    expect(
      screen.queryByRole("menuitem", { name: /automation rules/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /admin panel/i }),
    ).not.toBeInTheDocument();
  });

  it("renders mobile drawer navigation with parity for grouped sections", () => {
    renderNavbar("admin");

    // Open mobile menu
    const hamburgerBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(hamburgerBtn);

    const mobileNav = screen.getByRole("navigation", {
      name: /mobile navigation menu/i,
    });
    expect(mobileNav).toBeInTheDocument();

    // Verify grouped destinations exist in mobile drawer
    expect(
      within(mobileNav).getByText("Attendance Analytics"),
    ).toBeInTheDocument();
    expect(within(mobileNav).getByText("Knowledge Graph")).toBeInTheDocument();
    expect(within(mobileNav).getByText("Action Items")).toBeInTheDocument();
    expect(within(mobileNav).getByText("Automation Rules")).toBeInTheDocument();
  });
});
