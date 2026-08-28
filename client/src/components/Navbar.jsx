import React, {
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppContent from "../context/AppContent";
import { useRBAC } from "../hooks/useRBAC.js";
import useTheme from "../context/useTheme.jsx";
import usePreferences from "../context/usePreferences.jsx";
import { formatDateWithPreference } from "../utils/dateFormat.js";
import { toast } from "react-toastify";
import { notificationApi, authApi, organizationApi } from "../services";
import { validateRedirect } from "../utils/validateRedirect.js";
import { io } from "socket.io-client";
import { createClerkSocketOptions } from "../services/apiClient.js";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import BrandLogo from "./branding/BrandLogo.jsx";
import PwaInstallButton from "./pwa/PwaInstallButton.jsx";
import { useUser } from "@clerk/clerk-react";

import {
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Building2,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Sparkles,
  Users,
  CheckSquare,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Moon,
  Sun,
  Plus,
  Compass,
  Check,
  Code2,
  ScanSearch,
  GitMerge,
  History,
  Archive,
  Network,
  Clock,
  AlertTriangle,
  BookOpen,
  BarChart3,
  LineChart,
  TrendingUp,
  UserCheck,
  DollarSign,
  HeartPulse,
  Mic,
  FileText,
  GitCompare,
  Trash2,
  Bookmark,
  Tag,
  Zap,
  GitFork,
  FileSpreadsheet,
  Layers,
  ListTodo,
  CheckCheck,
  Smile,
  Lightbulb,
  Presentation,
  Brain,
} from "lucide-react";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const isPlaceholderClerkEmail = (email) => {
  if (!email || typeof email !== "string") return true;
  return (
    email.endsWith("@clerk.placeholder") ||
    /^user_[A-Za-z0-9]+(@|$)/.test(email)
  );
};

/** Shows Mongo email, falling back to Clerk primary email when Mongo still has a provision placeholder. */
const UserEmailText = ({ email, className }) => {
  if (!clerkPubKey || clerkPubKey.trim().length === 0) {
    return <p className={className}>{email || "user@example.com"}</p>;
  }
  return <ClerkUserEmailText email={email} className={className} />;
};

const ClerkUserEmailText = ({ email, className }) => {
  const { user } = useUser();
  const clerkEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null;
  const display = !isPlaceholderClerkEmail(email)
    ? email
    : clerkEmail || email || "user@example.com";

  return (
    <p className={className} title={display}>
      {display}
    </p>
  );
};

const NAV_LINK_KEYS = [
  { labelKey: "navbar.features", href: "#features" },
  { labelKey: "navbar.howItWorks", href: "#how-it-works" },
  { labelKey: "navbar.about", href: "#about" },
  { labelKey: "navbar.faq", href: "#faq" },
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { backendUrl, userData, setUserData, setIsLoggedin } =
    useContext(AppContent);
  const { hasPermission } = useRBAC();
  const { theme, toggleTheme, mounted } = useTheme();
  const { dateFormat } = usePreferences();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNotifOpen, setMobileNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [userOrgs, setUserOrgs] = useState([]);
  const [switchingOrg, setSwitchingOrg] = useState(false);

  const fetchUserOrgs = useCallback(async () => {
    try {
      const { data } = await organizationApi.getUserOrganizations();
      if (data.success) {
        setUserOrgs(data.organizations);
      }
    } catch (err) {
      console.error("Error fetching user orgs:", err);
    }
  }, []);

  useEffect(() => {
    if (userData) {
      fetchUserOrgs();
    }
  }, [userData, fetchUserOrgs]);

  const handleSwitchOrg = async (orgId) => {
    if (switchingOrg) return;
    setSwitchingOrg(true);
    try {
      const { data } = await organizationApi.selectOrganization({
        organizationId: orgId,
      });
      if (data.success) {
        toast.success(data.message || "Organization switched successfully");
        setUserData(data.userData);
        navigate("/dashboard");
        window.location.reload();
      } else {
        toast.error(data.message || "Failed to switch organization");
      }
    } catch (err) {
      console.error("Error switching organization:", err);
      toast.error(
        err.response?.data?.message || "Failed to switch organization",
      );
    } finally {
      setSwitchingOrg(false);
    }
  };

  useEffect(() => {
    setImgFailed(false);
  }, [userData?.profilePic]);

  // Fetch unread count from backend
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const formatTimeAgo = useCallback(
    (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const seconds = Math.floor((now - date) / 1000);

      if (seconds < 60) return "Just now";
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
      return formatDateWithPreference(date, dateFormat);
    },
    [dateFormat],
  );

  useEffect(() => {
    if (userData && backendUrl) {
      const fetchUnreadCount = async () => {
        try {
          const { data } = await notificationApi.getUnreadCount();
          if (data.success) {
            setUnreadCount(data.unreadCount);
          }
        } catch (err) {
          console.error("Error fetching unread count:", err);
        }
      };

      const fetchRecentNotifications = async () => {
        try {
          const { data } = await notificationApi.getNotifications({ limit: 5 });
          if (data.success) {
            setNotifications(
              data.notifications.map((n) => ({
                id: n._id || n.id,
                title: n.title,
                description: n.description,
                actionUrl: n.actionUrl || n.data?.url || n.url,
                time: formatTimeAgo(n.createdAt),
                unread: !n.isRead,
              })),
            );
          }
        } catch (err) {
          console.error("Error fetching notifications:", err);
        }
      };

      fetchUnreadCount();
      fetchRecentNotifications();
    }
  }, [userData, backendUrl, formatTimeAgo]);

  // Real-time notifications via Socket.IO
  useEffect(() => {
    if (!userData || !backendUrl) return;

    let socket;
    let cancelled = false;

    (async () => {
      const opts = await createClerkSocketOptions();
      if (cancelled) return;
      socket = io(backendUrl, opts);

      socket.on("connect", () => {
        console.log(
          "🟢 Real-time notifications connected. Socket ID:",
          socket.id,
        );
      });

      socket.on("connect_error", (err) => {
        console.error("🔴 Real-time notifications connect_error:", err.message);
      });

      socket.on("notification:new", (newNotif) => {
        setUnreadCount((prev) => prev + 1);
        setNotifications((prev) => {
          const formattedNotif = {
            id: newNotif._id || newNotif.id,
            title: newNotif.title,
            description: newNotif.description,
            actionUrl: newNotif.actionUrl || newNotif.data?.url || newNotif.url,
            time: "Just now",
            unread: true,
          };
          return [formattedNotif, ...prev].slice(0, 5);
        });
        toast.info(`🔔 ${newNotif.title}`);
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [userData, backendUrl]);

  const handleNotificationClick = async (notif) => {
    setNotificationsOpen(false);
    if (notif.unread && notif.id) {
      try {
        await notificationApi.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, unread: false } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
    const destination = validateRedirect(notif.actionUrl, "/notifications");
    navigate(destination);
  };

  const menuRef = useRef();
  const mobileMenuRef = useRef();
  const notificationsRef = useRef();
  const orgDropdownRef = useRef();
  const desktopNavRef = useRef();

  // Detect scroll for navbar style
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const listener = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target)
      ) {
        setNotificationsOpen(false);
      }
      if (
        orgDropdownRef.current &&
        !orgDropdownRef.current.contains(e.target)
      ) {
        setOrgDropdownOpen(false);
      }
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target) &&
        !e.target.closest("button[aria-expanded]")
      ) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  // Close menus on resize / route change
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
        setMobileNotifOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
        setOrgDropdownOpen(false);
        setOpenDropdown(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn(
        "Backend logout cookie clearance skipped locally:",
        err.message,
      );
    } finally {
      setUserData(null);
      localStorage.removeItem("userData");
      setIsLoggedin(false);
      if (clerkPubKey && clerkPubKey.trim().length > 0) {
        window.dispatchEvent(
          new CustomEvent("meetonmemory:request-clerk-signout"),
        );
      }
      toast.success("Logged out successfully");

      navigate("/");
    }
  };

  const handleNavLinkClick = (href) => {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      if (location.pathname !== "/") {
        navigate("/" + href);
      } else {
        const el = document.querySelector(href);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    } else {
      navigate(href);
    }
  };

  const isTabActive = useCallback(
    (tabPath) => {
      const currentPath = location.pathname;
      if (tabPath === "/dashboard") {
        return currentPath === "/dashboard";
      }
      if (tabPath === "/meetings") {
        return (
          currentPath === "/meetings" ||
          currentPath.startsWith("/meetings/") ||
          currentPath === "/create-meeting" ||
          currentPath === "/upload-meeting" ||
          currentPath === "/summaries" ||
          currentPath === "/reports" ||
          currentPath === "/policies" ||
          currentPath === "/parking-lot"
        );
      }
      if (tabPath === "/meeting-series") {
        return currentPath.startsWith("/meeting-series");
      }
      if (tabPath === "/organizations") {
        return (
          currentPath === "/organizations" ||
          currentPath === "/create-organization" ||
          currentPath === "/join-organization" ||
          currentPath.startsWith("/organizations/")
        );
      }
      return currentPath === tabPath;
    },
    [location.pathname],
  );

  // Grouped Navigation definition with RBAC filtering
  const navGroups = useMemo(() => {
    const rawGroups = [
      {
        id: "meetings",
        label: t("navbar.meetings"),
        icon: Calendar,
        items: [
          {
            label: t("navbar.meetings"),
            href: "/meetings",
            icon: Calendar,
            permission: { resource: "meetings", action: "view" },
          },
          {
            label: t("navbar.meetingSeries"),
            href: "/meeting-series",
            icon: CalendarDays,
            permission: { resource: "meetings", action: "view" },
          },
          {
            label: t("navbar.orgTimeline", "Org Timeline"),
            href: "/timeline",
            icon: History,
            permission: { resource: "meetings", action: "view" },
          },
          {
            label: t("navbar.meetingTemplates"),
            href: "/meeting-templates",
            icon: GitMerge,
            permission: { resource: "meetings", action: "view" },
          },
          {
            label: t("navbar.sessionCards", "Session Cards"),
            href: "/session-cards",
            icon: Presentation,
            permission: { resource: "meetings", action: "view" },
          },
          {
            label: t("navbar.compareMeetings"),
            href: "/meetings/compare",
            icon: GitCompare,
            permission: { resource: "meetings", action: "view" },
          },
          {
            label: t("navbar.recycleBin"),
            href: "/meetings/recycle-bin",
            icon: Trash2,
            permission: { resource: "meetings", action: "view" },
          },
          {
            label: t("navbar.parkingLot"),
            href: "/parking-lot",
            icon: Lightbulb,
            permission: { resource: "meetings", action: "view" },
          },
        ],
      },
      {
        id: "workspace",
        label: t("navbar.workspace"),
        icon: CheckSquare,
        items: [
          {
            label: t("navbar.tasks"),
            href: "/tasks",
            icon: CheckSquare,
            permission: { resource: "tasks", action: "view" },
          },
          {
            label: t("navbar.actionItems"),
            href: "/action-items",
            icon: ListTodo,
            permission: { resource: "tasks", action: "view" },
          },
          {
            label: t("navbar.followups"),
            href: "/followup",
            icon: CheckCheck,
            permission: { resource: "tasks", action: "view" },
          },
          {
            label: t("navbar.workloadBalance"),
            href: "/workload",
            icon: Activity,
            permission: { resource: "tasks", action: "view" },
          },
          {
            label: t("navbar.calendar"),
            href: "/calendar",
            icon: CalendarDays,
            permission: { resource: "calendar", action: "view" },
          },
          {
            label: t("navbar.focusTime"),
            href: "/focus-time",
            icon: Clock,
          },
          {
            label: t("navbar.myDelegations"),
            href: "/delegations",
            icon: Users,
          },
          {
            label: t("navbar.escalations"),
            href: "/escalations",
            icon: AlertTriangle,
          },
          {
            label: t("navbar.bookmarks"),
            href: "/bookmarks",
            icon: Bookmark,
            permission: { resource: "bookmarks", action: "view" },
          },
          {
            label: t("navbar.activityFeed"),
            href: "/activities",
            icon: Activity,
          },
          {
            label: t("navbar.tags"),
            href: "/tags",
            icon: Tag,
          },
        ],
      },
      {
        id: "insights",
        label: t("navbar.insights"),
        icon: BarChart3,
        items: [
          {
            label: t("navbar.attendanceAnalytics"),
            href: "/attendance-analytics",
            icon: UserCheck,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.costAnalytics"),
            href: "/meeting-cost-analytics",
            icon: DollarSign,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.meetingInsights"),
            href: "/meeting-insights",
            icon: Brain,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.meetingHealth"),
            href: "/meeting-health",
            icon: HeartPulse,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.speakingTime"),
            href: "/speaking-time-trends",
            icon: Mic,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.speakingCompare"),
            href: "/speaking-time-compare",
            icon: GitCompare,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.actionItemAnalytics"),
            href: "/action-item-analytics",
            icon: BarChart3,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.topicExplorer"),
            href: "/topics",
            icon: Compass,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.reportsAndInsights"),
            href: "/reports",
            icon: FileText,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.weeklyInsights"),
            href: "/reports/weekly-insights",
            icon: Sparkles,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.meetingPatterns"),
            href: "/patterns",
            icon: TrendingUp,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.engagement"),
            href: "/engagement",
            icon: LineChart,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.sentimentTrends", "Sentiment Trends"),
            href: "/sentiment-trends",
            icon: Smile,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.slaCompliance"),
            href: "/sla-compliance",
            icon: ShieldAlert,
            permission: { resource: "reports", action: "view" },
          },
          {
            label: t("navbar.policyCompliance"),
            href: "/policy-compliance",
            icon: ShieldCheck,
            permission: { resource: "policies", action: "view" },
          },
        ],
      },
      {
        id: "knowledge",
        label: t("navbar.knowledge"),
        icon: Network,
        items: [
          {
            label: t("navbar.knowledgeGraph"),
            href: "/knowledge/graph",
            icon: Network,
            permission: { resource: "knowledge", action: "view" },
          },
          {
            label: t("navbar.decisionGraph"),
            href: "/decisions/graph",
            icon: GitFork,
            permission: { resource: "knowledge", action: "view" },
          },
          {
            label: t("navbar.decisionLog"),
            href: "/decision-log",
            icon: FileSpreadsheet,
            permission: { resource: "knowledge", action: "view" },
          },
          {
            label: t("navbar.memoryConsolidation"),
            href: "/knowledge/consolidate",
            icon: Layers,
            permission: { resource: "knowledge", action: "view" },
          },
          {
            label: t("navbar.conflictResolution"),
            href: "/knowledge/conflicts",
            icon: ScanSearch,
            permission: { resource: "knowledge", action: "view" },
          },
          {
            label: t("navbar.memoryLifecycle"),
            href: "/knowledge/lifecycle",
            icon: History,
            permission: { resource: "knowledge", action: "view" },
          },
          {
            label: t("navbar.knowledgeArchive"),
            href: "/knowledge/archive",
            icon: Archive,
            permission: { resource: "knowledge", action: "view" },
          },
          {
            label: t("navbar.graphHistory"),
            href: "/knowledge/graph-history",
            icon: History,
            permission: { resource: "knowledge", action: "view" },
          },
          {
            label: t("navbar.glossary"),
            href: "/glossary",
            icon: BookOpen,
            permission: { resource: "knowledge", action: "view" },
          },
        ],
      },
      {
        id: "admin",
        label: t("navbar.admin"),
        icon: Building2,
        items: [
          {
            label: t("navbar.organizations"),
            href: "/organizations",
            icon: Building2,
            permission: { resource: "organizations", action: "view" },
          },
          {
            label: t("navbar.teamMembers"),
            href: "/team-members",
            icon: Users,
            permission: { resource: "team_members", action: "view" },
          },
          {
            label: t("navbar.automationRules"),
            href: "/automation-rules",
            icon: Zap,
            permission: { resource: "automation_rules", action: "view" },
          },
          {
            label: t("navbar.recapSchedule"),
            href: "/recap-schedule",
            icon: Clock,
            permission: { resource: "settings", action: "view" },
          },
          {
            label: t("navbar.adminPanel"),
            href: "/admin-panel",
            icon: Sparkles,
            permission: { resource: "admin_panel", action: "view" },
          },
        ],
      },
    ];

    // Filter items and groups by user RBAC permissions
    return rawGroups
      .map((group) => {
        const filteredItems = group.items.filter(
          (item) =>
            !item.permission ||
            hasPermission(item.permission.resource, item.permission.action),
        );
        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [hasPermission, t]);

  const isGroupActive = useCallback(
    (group) => {
      return group.items.some(
        (item) =>
          location.pathname === item.href ||
          (item.href !== "/" &&
            item.href !== "/dashboard" &&
            location.pathname.startsWith(item.href)),
      );
    },
    [location.pathname],
  );

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md border-b border-gray-100/80 dark:border-gray-800/80"
          : "bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-1.5 sm:gap-3 cursor-pointer group focus-visible:outline-none shrink-0 min-w-0"
            onClick={() => navigate("/")}
            role="link"
            aria-label="MeetOnMemory Home"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate("/")}
          >
            <div className="flex items-center justify-center shrink-0">
              <BrandLogo
                variant="mark"
                alt=""
                aria-hidden="true"
                className="relative w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <span className="font-bold text-lg sm:text-2xl text-gray-900 dark:text-gray-100 tracking-tight shrink-0">
              MeetOn
              <span className="text-blue-600 dark:text-blue-400">Memory</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          {userData ? (
            /* Logged In Desktop App Nav */
            <nav
              ref={desktopNavRef}
              className="hidden md:flex items-center gap-1 lg:gap-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 p-1 rounded-2xl"
              aria-label="Application navigation"
            >
              {/* Direct Dashboard Link */}
              <button
                type="button"
                onClick={() => {
                  setOpenDropdown(null);
                  navigate("/dashboard");
                }}
                aria-current={isTabActive("/dashboard") ? "page" : undefined}
                className={`flex items-center gap-1.5 px-3 lg:px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 cursor-pointer ${
                  isTabActive("/dashboard")
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs border border-gray-100/50 dark:border-gray-600/50"
                    : "text-gray-600 dark:text-gray-300 border border-transparent hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/60 dark:hover:bg-gray-700/60"
                }`}
              >
                <span>{t("navbar.dashboard")}</span>
              </button>

              {/* Grouped Category Dropdowns */}
              {navGroups.map((group) => {
                const groupActive = isGroupActive(group);
                const isOpen = openDropdown === group.id;
                return (
                  <div key={group.id} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown((prev) =>
                          prev === group.id ? null : group.id,
                        )
                      }
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      aria-label={`${group.label} menu`}
                      className={`flex items-center gap-1 px-3 lg:px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                        groupActive || isOpen
                          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs border border-gray-100/50 dark:border-gray-600/50"
                          : "text-gray-600 dark:text-gray-300 border border-transparent hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/60 dark:hover:bg-gray-700/60"
                      }`}
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Category Dropdown Popover */}
                    {isOpen && (
                      <div
                        role="menu"
                        aria-label={`${group.label} sub-navigation`}
                        className={`absolute left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150 ${
                          group.items.length > 6
                            ? "w-80 max-h-96 overflow-y-auto"
                            : "w-56"
                        }`}
                      >
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700/60 mb-1">
                          {group.label}
                        </div>
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const active = isTabActive(item.href);
                          return (
                            <button
                              key={item.href}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdown(null);
                                navigate(item.href);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors text-left cursor-pointer ${
                                active
                                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                              }`}
                            >
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  active
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-400 dark:text-gray-500"
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          ) : (
            /* Logged Out Desktop Marketing Nav */
            <nav
              className="hidden md:flex items-center gap-1.5"
              aria-label="Marketing navigation"
            >
              {NAV_LINK_KEYS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavLinkClick(link.href)}
                  className="px-3.5 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 rounded-xl hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                >
                  {t(link.labelKey)}
                </button>
              ))}
            </nav>
          )}

          {/* Right Side Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3 shrink-0">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label={
                mounted
                  ? theme === "light"
                    ? t("navbar.switchToDark")
                    : t("navbar.switchToLight")
                  : t("navbar.toggleTheme")
              }
            >
              {mounted && theme === "light" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>

            {userData ? (
              <>
                {/* Organization Switcher */}
                <div className="relative hidden md:block" ref={orgDropdownRef}>
                  <button
                    onClick={() => setOrgDropdownOpen((s) => !s)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200/60 dark:border-gray-600/60 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                    aria-expanded={orgDropdownOpen}
                    aria-haspopup="true"
                    aria-label="Switch organization"
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 overflow-hidden">
                      {userData.organization?.logo ? (
                        <img
                          src={userData.organization.logo}
                          alt={userData.organization.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="text-left max-w-[130px] truncate">
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                        {userData.organization?.name || "Select Org"}
                      </p>
                      <div className="flex items-center gap-1">
                        <p
                          className={`text-[9px] uppercase tracking-wider font-semibold ${
                            userData.role === "viewer" ||
                            userData.role === "guest"
                              ? "text-amber-600 dark:text-amber-400 font-bold"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {userData.role || "Member"}
                        </p>
                        {(userData.role === "viewer" ||
                          userData.role === "guest") && (
                          <span className="text-[8px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold px-1 rounded">
                            READ-ONLY
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 shrink-0 ${
                        orgDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {orgDropdownOpen && (
                    <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-2 bg-gray-50/80 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                          Current Organization
                        </p>
                      </div>

                      <div className="p-1.5 max-h-56 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                        {userOrgs.length > 0 ? (
                          userOrgs.map((org) => {
                            const isCurrent =
                              org._id === userData.organization?._id;
                            return (
                              <button
                                key={org._id}
                                onClick={() => {
                                  setOrgDropdownOpen(false);
                                  if (!isCurrent) handleSwitchOrg(org._id);
                                }}
                                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                                  isCurrent
                                    ? "bg-blue-50/75 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold"
                                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100"
                                }`}
                                disabled={switchingOrg}
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200/40 dark:border-gray-600/40">
                                    {org.logo ? (
                                      <img
                                        src={org.logo}
                                        alt={org.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                                    )}
                                  </div>
                                  <div className="truncate">
                                    <p className="text-xs truncate">
                                      {org.name}
                                    </p>
                                    <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider capitalize font-semibold">
                                      {org.role || "Member"}
                                    </p>
                                  </div>
                                </div>
                                {isCurrent && (
                                  <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="py-4 text-center text-gray-400 dark:text-gray-500 text-xs">
                            No joined organizations
                          </div>
                        )}
                      </div>

                      <div className="p-1.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <button
                          onClick={() => {
                            setOrgDropdownOpen(false);
                            navigate("/organization/settings");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          Organization Settings
                        </button>
                        <button
                          onClick={() => {
                            setOrgDropdownOpen(false);
                            navigate("/create-organization");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          Create Organization
                        </button>
                        <button
                          onClick={() => {
                            setOrgDropdownOpen(false);
                            navigate("/browse-organizations");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <Compass className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          Browse Organizations
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* PWA Install Button */}
                <PwaInstallButton className="hidden md:inline-flex shrink-0" />

                {/* Desktop Notification Area */}
                <div
                  className="relative hidden sm:block"
                  ref={notificationsRef}
                >
                  <button
                    onClick={() => setNotificationsOpen((s) => !s)}
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                      notificationsOpen
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    aria-expanded={notificationsOpen}
                    aria-haspopup="true"
                    aria-label="Open notifications menu"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-gray-800 animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Popover */}
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-3.5 bg-gray-50/80 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600 flex items-center justify-between">
                        <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                          {t("navbar.notifications")}
                        </span>
                        <button
                          onClick={() => {
                            setNotificationsOpen(false);
                            navigate("/notifications");
                          }}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                        >
                          {t("navbar.viewAll")}
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <button
                              key={notif.id}
                              type="button"
                              onClick={() => handleNotificationClick(notif)}
                              className={`w-full p-3.5 hover:bg-blue-50/20 dark:hover:bg-blue-900/20 transition-colors text-left block cursor-pointer ${
                                notif.unread
                                  ? "bg-blue-50/5 dark:bg-blue-900/10"
                                  : ""
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <p className="font-semibold text-xs text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                                  {notif.unread && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"></span>
                                  )}
                                  {notif.title}
                                </p>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
                                  {formatTimeAgo(notif.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                {notif.description}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
                            {t("navbar.noNotifications")}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile / Dropdown Menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((s) => !s)}
                    className="flex items-center gap-1.5 p-1 pr-2.5 rounded-xl border border-gray-200/60 dark:border-gray-600/60 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    aria-label="Open user menu"
                  >
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                      <div className="absolute inset-0 bg-linear-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {userData?.name
                          ? userData.name.charAt(0).toUpperCase()
                          : "U"}
                      </div>
                      {userData?.profilePic && !imgFailed && (
                        <img
                          src={userData.profilePic}
                          alt={userData.name}
                          className="absolute inset-0 w-full h-full object-cover border border-gray-200/40"
                          onError={() => setImgFailed(true)}
                        />
                      )}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                        menuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpen && (
                    <div className="absolute right-0 mt-3 w-60 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-3.5 bg-gray-50/80 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600">
                        <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                          {t("navbar.signedInAs")}
                        </p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                          {userData?.name || "User"}
                        </p>
                        <UserEmailText
                          email={userData?.email}
                          className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5"
                        />
                        <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              userData?.role === "viewer" ||
                              userData?.role === "guest"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                : "text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600"
                            }`}
                          >
                            {userData?.role || "Member"}{" "}
                            {userData?.role === "viewer" ||
                            userData?.role === "guest"
                              ? "(Read-Only)"
                              : ""}
                          </span>
                          {userData?.organization?.name && (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full truncate max-w-[120px] uppercase">
                              {userData.organization.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-1">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/dashboard");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          {t("navbar.dashboard")}
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/rsvps");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-400 dark:text-gray-500"
                          >
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                          </svg>
                          RSVP Inbox
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/profile");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <User className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          {t("navbar.myProfile")}
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/settings");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <Settings className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          {t("navbar.settings")}
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/docs");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <Code2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          Developer Docs
                        </button>

                        {hasPermission("admin_panel", "view") && (
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              navigate("/admin-panel");
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                            role="menuitem"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                            {t("navbar.adminPanel")}
                          </button>
                        )}
                      </div>

                      <div className="border-t border-gray-100 dark:border-gray-600 p-1">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                          {t("navbar.logout")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
                aria-label="Login to MeetOnMemory"
              >
                {t("navbar.login")}
              </button>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              onClick={() => setMobileOpen((s) => !s)}
              aria-expanded={mobileOpen}
              aria-label={
                mobileOpen ? t("navbar.closeMenu") : t("navbar.openMenu")
              }
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <div
        ref={mobileMenuRef}
        className={`md:hidden transition-all duration-300 ease-in-out bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-lg ${
          mobileOpen ? "opacity-100 visible" : "opacity-0 invisible max-h-0"
        }`}
        style={{
          maxHeight: mobileOpen ? "calc(100vh - 4rem)" : "0",
          height: mobileOpen ? "calc(100vh - 4rem)" : "0",
        }}
        aria-hidden={!mobileOpen}
        role="navigation"
        aria-label="Mobile navigation menu"
      >
        <div className="h-full overflow-y-auto overflow-x-hidden overscroll-contain">
          <nav
            className="px-4 py-5 flex flex-col gap-1.5 min-h-full"
            aria-label="Mobile navigation"
          >
            {userData ? (
              /* Logged In Mobile Nav List */
              <>
                {/* User Profile Card */}
                <div className="px-3.5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100/60 dark:border-gray-700 flex items-center gap-3 rounded-2xl mb-2 sticky top-0 z-10 backdrop-blur-sm bg-opacity-95">
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                      {userData?.name
                        ? userData.name.charAt(0).toUpperCase()
                        : "U"}
                    </div>
                    {userData?.profilePic && !imgFailed && (
                      <img
                        src={userData.profilePic}
                        alt={userData.name}
                        className="absolute inset-0 w-full h-full object-cover border border-gray-200/40"
                        onError={() => setImgFailed(true)}
                      />
                    )}
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                      {userData?.name || "User"}
                    </p>
                    <UserEmailText
                      email={userData?.email}
                      className="text-xs text-gray-400 dark:text-gray-500 truncate"
                    />
                  </div>
                </div>

                {/* Mobile Organization Switcher */}
                <div className="px-3.5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100/60 dark:border-gray-700 rounded-2xl mb-2">
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 overflow-hidden">
                        {userData.organization?.logo ? (
                          <img
                            src={userData.organization.logo}
                            alt={userData.organization.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="truncate min-w-0">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                          {userData.organization?.name || "Select Org"}
                        </p>
                        <div className="flex items-center gap-1">
                          <p
                            className={`text-[9px] uppercase tracking-wider font-semibold ${
                              userData.role === "viewer" ||
                              userData.role === "guest"
                                ? "text-amber-600 dark:text-amber-400 font-bold"
                                : "text-gray-400 dark:text-gray-500"
                            }`}
                          >
                            Current: {userData.role || "Member"}
                          </p>
                          {(userData.role === "viewer" ||
                            userData.role === "guest") && (
                            <span className="text-[8px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold px-1 rounded">
                              READ-ONLY
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto mb-2 custom-scrollbar">
                    {userOrgs.length > 0 ? (
                      userOrgs.map((org) => {
                        const isCurrent =
                          org._id === userData.organization?._id;
                        return (
                          <button
                            key={org._id}
                            onClick={() => {
                              setMobileOpen(false);
                              if (!isCurrent) handleSwitchOrg(org._id);
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg text-left text-xs cursor-pointer transition-colors ${
                              isCurrent
                                ? "bg-blue-50/75 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50"
                            }`}
                            disabled={switchingOrg}
                          >
                            <span className="truncate min-w-0 flex-1">
                              {org.name} ({org.role || "Member"})
                            </span>
                            {isCurrent && (
                              <Check className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-2 text-center text-gray-400 dark:text-gray-500 text-xs">
                        No joined organizations
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        navigate("/create-organization");
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 border border-gray-200/60 dark:border-gray-600 rounded-lg text-[11px] font-bold text-gray-700 dark:text-gray-200 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create Org</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        navigate("/browse-organizations");
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 border border-gray-200/60 dark:border-gray-600 rounded-lg text-[11px] font-bold text-gray-700 dark:text-gray-200 cursor-pointer transition-colors"
                    >
                      <Compass className="w-3 h-3" />
                      <span>Browse Orgs</span>
                    </button>
                  </div>
                </div>

                {/* Dashboard Direct Route */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/dashboard");
                  }}
                  aria-current={isTabActive("/dashboard") ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                    isTabActive("/dashboard")
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  <LayoutDashboard
                    className={`w-5 h-5 shrink-0 ${
                      isTabActive("/dashboard")
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  />
                  <span>{t("navbar.dashboard")}</span>
                </button>

                {/* Grouped Navigation Sections */}
                {navGroups.map((group) => (
                  <div key={group.id} className="py-2">
                    <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {group.label}
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {group.items.map((link) => {
                        const Icon = link.icon;
                        const active = isTabActive(link.href);
                        return (
                          <button
                            key={link.href}
                            type="button"
                            onClick={() => {
                              setMobileOpen(false);
                              navigate(link.href);
                            }}
                            aria-current={active ? "page" : undefined}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                              active
                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                active
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}
                            />
                            <span className="truncate">{link.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Secondary Links & Actions */}
                <div className="border-t border-gray-100 dark:border-gray-700 my-3"></div>

                <button
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/notifications");
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                    mobileNotifOpen
                      ? "bg-blue-50/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Bell
                      className={`w-5 h-5 shrink-0 ${
                        mobileNotifOpen
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    />
                    <span>{t("navbar.notifications")}</span>
                  </div>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0">
                      {unreadCount} {t("navbar.new")}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/profile");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl transition-all cursor-pointer"
                >
                  <User className="w-5 h-5 shrink-0 text-gray-400 dark:text-gray-500" />
                  <span>{t("navbar.myProfile")}</span>
                </button>

                <button
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/settings");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl transition-all cursor-pointer"
                >
                  <Settings className="w-5 h-5 shrink-0 text-gray-400 dark:text-gray-500" />
                  <span>{t("navbar.settings")}</span>
                </button>

                {/* Logout Button - Sticky at bottom */}
                <div className="border-t border-gray-100 dark:border-gray-700 mt-3 pt-3 sticky bottom-0 bg-white dark:bg-gray-900 pb-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all cursor-pointer"
                  >
                    <LogOut className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
                    <span>{t("navbar.logout")}</span>
                  </button>
                </div>
              </>
            ) : (
              /* Logged Out Mobile Nav List */
              <>
                <div className="space-y-1 py-2">
                  {NAV_LINK_KEYS.map((link) => (
                    <button
                      key={link.href}
                      onClick={() => handleNavLinkClick(link.href)}
                      className="w-full text-left px-4 py-3.5 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      {t(link.labelKey)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/signup");
                  }}
                  className="mt-3 w-full px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all duration-200 text-center cursor-pointer"
                >
                  {t("navbar.getStarted")}
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
