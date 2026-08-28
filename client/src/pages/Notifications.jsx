import React, { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppContent from "../context/AppContent";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import { notificationApi } from "../services";
import { validateRedirect } from "../utils/validateRedirect.js";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Calendar,
  Brain,
  Building2,
  ListChecks,
  Shield,
  BarChart3,
  AlertCircle,
  X,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Layers,
  Radio,
} from "lucide-react";
import {
  groupNotifications,
  notificationId,
} from "../utils/groupNotifications.js";
import NudgeInbox from "../components/NudgeInbox";
import KeywordWatchlistPanel from "../components/notifications/KeywordWatchlistPanel.jsx";
import { useDebounce } from "../hooks/useDebounce.js";

/**
 * Issue #977 & #1214: Category icons mapping for all notification types.
 * `tasks` category was added to separate action-item reminders from meeting notifications.
 * This enables proper filtering and categorization of task-related notifications.
 */
const CATEGORY_ICONS = {
  meetings: Calendar,
  tasks: ListChecks,
  ai_processing: Brain,
  organizations: Building2,
  policies: Shield,
  reports: BarChart3,
  system: AlertCircle,
};

/**
 * Color scheme for each notification category (light/dark mode support)
 */
const CATEGORY_COLORS = {
  meetings:
    "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  tasks:
    "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800",
  ai_processing:
    "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
  organizations:
    "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  policies:
    "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  reports:
    "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800",
  system:
    "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800",
};

/**
 * Human-readable labels for each notification category
 * Used in filter dropdown and notification cards
 */
const CATEGORY_LABELS = {
  meetings: "Meetings",
  tasks: "Tasks",
  ai_processing: "AI Processing",
  organizations: "Organizations",
  policies: "Policies",
  reports: "Reports",
  system: "System",
};

/**
 * Format timestamp to relative time (e.g., "5m ago", "2h ago")
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted relative time
 */
const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

/**
 * Notifications Page Component
 *
 * Features:
 * - Paginated notification list with infinite scroll support
 * - Multi-category filtering (All, Meetings, Tasks, AI Processing, Organizations, Policies, Reports, System)
 * - Read/unread status management
 * - Bulk mark as read functionality
 * - Delete individual notifications
 * - Real-time notification updates via Socket.IO
 * - Responsive design with dark mode support
 *
 * Issue #1214: Added "Tasks" filter to allow users to view only task-related notifications
 */
const Notifications = () => {
  const navigate = useNavigate();
  const { userData } = useContext(AppContent);

  // State management for notifications
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "keywords" ? "keywords" : "all",
  );

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "keywords") {
      setActiveTab("keywords");
    } else {
      setActiveTab("all");
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "keywords") {
      setSearchParams({ tab: "keywords" });
    } else {
      setSearchParams({});
    }
  };

  // Filter states
  const [filter, setFilter] = useState("all"); // all, read, unread
  const [categoryFilter, setCategoryFilter] = useState("all"); // all, meetings, tasks, ai_processing, organizations, policies, reports, system
  const [groupBy, setGroupBy] = useState("day"); // none, day, meeting, type
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [digestSaving, setDigestSaving] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Fetch notifications from API with current filter and pagination
   * Supports filtering by status (read/unread) and category (meetings/tasks/etc.)
   */
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: 20 };

      // Apply status filter (read/unread/all)
      if (filter !== "all") params.status = filter;

      // Apply category filter (meetings/tasks/ai_processing/etc.)
      // Issue #1214: Tasks filter now properly supported
      if (categoryFilter !== "all") params.category = categoryFilter;

      if (debouncedSearchQuery) params.search = debouncedSearchQuery;

      const { data } = await notificationApi.getNotifications(params);

      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notifications");
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [filter, categoryFilter, page, debouncedSearchQuery]);

  // Reset to page 1 when user logs in or filters change
  useEffect(() => {
    if (userData) {
      setPage(1);
    }
  }, [userData, filter, categoryFilter, debouncedSearchQuery]);

  // Fetch notifications when dependencies change
  useEffect(() => {
    if (userData) {
      fetchNotifications();
    }
  }, [userData, fetchNotifications]);

  useEffect(() => {
    if (!userData) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await notificationApi.getPreferences();
        if (!cancelled && data?.success) {
          setDailyDigest(Boolean(data.preferences?.emailDailyDigest));
        }
      } catch {
        // Preferences are optional for viewing the list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userData]);

  /**
   * Mark a single notification as read
   * @param {string} id - ID of notification to mark as read
   */
  const handleMarkAsRead = async (id) => {
    try {
      const { data } = await notificationApi.markAsRead(id);
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            notificationId(n) === String(id) ? { ...n, isRead: true } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error marking as read:", err);
      toast.error("Failed to mark as read");
    }
  };

  /**
   * Mark all notifications in a group as read (Issue #2064)
   */
  const handleMarkGroupAsRead = async (items) => {
    const unreadIds = items
      .filter((n) => !n.isRead)
      .map((n) => notificationId(n))
      .filter(Boolean);
    if (unreadIds.length === 0) return;

    try {
      const { data } = await notificationApi.markGroupAsRead(unreadIds);
      if (data.success) {
        const idSet = new Set(unreadIds);
        setNotifications((prev) =>
          prev.map((n) =>
            idSet.has(notificationId(n)) ? { ...n, isRead: true } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - unreadIds.length));
        toast.success("Group marked as read");
      }
    } catch (err) {
      console.error("Error marking group as read:", err);
      toast.error("Failed to mark group as read");
    }
  };

  const handleDailyDigestToggle = async () => {
    const next = !dailyDigest;
    setDigestSaving(true);
    try {
      const { data } = await notificationApi.updatePreferences({
        emailDailyDigest: next,
      });
      if (data.success) {
        setDailyDigest(next);
        toast.success(
          next
            ? "Daily notification digest enabled"
            : "Daily notification digest disabled",
        );
      }
    } catch (err) {
      console.error("Error updating digest preference:", err);
      toast.error("Failed to update digest preference");
    } finally {
      setDigestSaving(false);
    }
  };

  /**
   * Mark all notifications as read
   */
  const handleMarkAllAsRead = async () => {
    try {
      const { data } = await notificationApi.markAllAsRead();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        toast.success("All notifications marked as read");
      }
    } catch (err) {
      console.error("Error marking all as read:", err);
      toast.error("Failed to mark all as read");
    }
  };

  /**
   * Delete a notification
   * @param {string} notificationId - ID of notification to delete
   */
  const handleDelete = async (id) => {
    try {
      const { data } = await notificationApi.deleteNotification(id);
      if (data.success) {
        setNotifications((prev) =>
          prev.filter((n) => notificationId(n) !== String(id)),
        );
        toast.success("Notification deleted");
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
      toast.error("Failed to delete notification");
    }
  };

  /**
   * Handle notification click - mark as read and navigate to action URL
   * @param {Object} notification - Notification object
   */
  const handleNotificationClick = (notification) => {
    const id = notificationId(notification);
    if (!notification.isRead && id) {
      handleMarkAsRead(id);
    }
    if (notification.actionUrl) {
      const safeUrl = validateRedirect(notification.actionUrl, null);
      if (safeUrl) {
        navigate(safeUrl);
      } else {
        toast.error("Invalid or unsafe link");
      }
    }
  };

  const groupedNotifications = groupNotifications(notifications, groupBy);

  // Redirect to login if not authenticated
  if (!userData) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Bell className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                Notifications
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Stay updated with your meetings, tasks, and organization
                activity
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-xl transition-all"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All as Read
              </button>
            )}
          </div>

          {/* Navigation Tabs (Issue #2424) */}
          <div
            role="tablist"
            aria-label="Notification Views"
            className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-6"
          >
            <button
              role="tab"
              aria-selected={activeTab === "all"}
              aria-controls="notifications-panel"
              onClick={() => handleTabChange("all")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "all"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Bell className="w-4 h-4" />
              All Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === "keywords"}
              aria-controls="keyword-watchlist-panel"
              data-testid="tab-keyword-watchlist"
              onClick={() => handleTabChange("keywords")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "keywords"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Radio className="w-4 h-4" />
              Keyword Watchlist
            </button>
          </div>
        </div>

        {activeTab === "keywords" ? (
          <div id="keyword-watchlist-panel" role="tabpanel">
            <KeywordWatchlistPanel />
          </div>
        ) : (
          <div id="notifications-panel" role="tabpanel" className="space-y-6">
            <NudgeInbox organizationId={userData?.currentOrganization} />

            {/* Filters Section - Issue #1214: Tasks filter added; #2064 grouping + digest */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Filters
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Status Filter (Read/Unread) */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Status
                  </label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="all">All Notifications</option>
                    <option value="unread">Unread Only</option>
                    <option value="read">Read Only</option>
                  </select>
                </div>

                {/* Category Filter - Issue #1214: Added Tasks option */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="all">All Categories</option>
                    <option value="meetings">Meetings</option>
                    <option value="tasks">Tasks</option>
                    <option value="ai_processing">AI Processing</option>
                    <option value="organizations">Organizations</option>
                    <option value="policies">Policies</option>
                    <option value="reports">Reports</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Group by
                  </label>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="day">Day</option>
                    <option value="meeting">Meeting</option>
                    <option value="type">Type</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dailyDigest}
                    disabled={digestSaving}
                    onChange={handleDailyDigestToggle}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Daily notification digest
                </label>
              </div>

              {/* Active Filter Indicators */}
              {(filter !== "all" || categoryFilter !== "all") && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Active filters:
                  </span>
                  {filter !== "all" && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium">
                      Status: {filter === "unread" ? "Unread" : "Read"}
                      <button
                        onClick={() => setFilter("all")}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {categoryFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 rounded-md text-xs font-medium">
                      Category: {CATEGORY_LABELS[categoryFilter]}
                      <button
                        onClick={() => setCategoryFilter("all")}
                        className="hover:text-teal-900 dark:hover:text-teal-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setFilter("all");
                      setCategoryFilter("all");
                    }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Loading notifications...
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  Error Loading Notifications
                </h3>
                <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
                <button
                  onClick={fetchNotifications}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && notifications.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                <Bell className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  No Notifications
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {filter !== "all" || categoryFilter !== "all"
                    ? "No notifications match your current filters. Try adjusting them."
                    : "You're all caught up! No new notifications to display."}
                </p>
                {(filter !== "all" || categoryFilter !== "all") && (
                  <button
                    onClick={() => {
                      setFilter("all");
                      setCategoryFilter("all");
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {/* Notifications List (grouped — Issue #2064) */}
            {!loading && !error && notifications.length > 0 && (
              <div className="space-y-6">
                {groupedNotifications.map((group) => {
                  const unreadInGroup = group.items.filter(
                    (n) => !n.isRead,
                  ).length;
                  const typeLabel =
                    groupBy === "type"
                      ? CATEGORY_LABELS[group.label] || group.label
                      : group.label;

                  return (
                    <section key={group.key} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-slate-400" />
                          {typeLabel}
                          <span className="text-xs font-medium text-slate-500">
                            ({group.items.length})
                          </span>
                        </h2>
                        {unreadInGroup > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMarkGroupAsRead(group.items)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            Mark group as read
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {group.items.map((notification) => {
                          const id = notificationId(notification);
                          const IconComponent =
                            CATEGORY_ICONS[notification.category] ||
                            AlertCircle;
                          const colorClass =
                            CATEGORY_COLORS[notification.category] ||
                            CATEGORY_COLORS.system;

                          return (
                            <div
                              key={id}
                              onClick={() =>
                                handleNotificationClick(notification)
                              }
                              className={`group relative bg-white dark:bg-slate-800 rounded-2xl border transition-all cursor-pointer hover:shadow-lg ${
                                notification.isRead
                                  ? "border-slate-200 dark:border-slate-700"
                                  : "border-blue-300 dark:border-blue-700 shadow-md"
                              }`}
                            >
                              <div className="p-5">
                                <div className="flex items-start gap-4">
                                  <div
                                    className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 flex items-center justify-center ${colorClass}`}
                                  >
                                    <IconComponent className="w-6 h-6" />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <h3
                                        className={`text-base font-semibold ${
                                          notification.isRead
                                            ? "text-slate-700 dark:text-slate-300"
                                            : "text-slate-900 dark:text-white"
                                        }`}
                                      >
                                        {notification.title}
                                      </h3>
                                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {formatTimeAgo(notification.createdAt)}
                                      </span>
                                    </div>

                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                                      {notification.description}
                                    </p>

                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                        {CATEGORY_LABELS[
                                          notification.category
                                        ] || "System"}
                                      </span>
                                      {!notification.isRead && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                                          New
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex-shrink-0 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                                    {!notification.isRead && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMarkAsRead(id);
                                        }}
                                        aria-label={`Mark "${notification.title}" as read`}
                                        className="p-3 sm:p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                                        title="Mark as read"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(id);
                                      }}
                                      aria-label={`Delete notification "${notification.title}"`}
                                      className="p-3 sm:p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {notification.actionUrl && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNotificationClick(notification);
                                    }}
                                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                  >
                                    {notification.actionLabel || "View Details"}
                                    <ArrowRight className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Showing {(pagination.page - 1) * pagination.limit + 1}
                  {" - "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}
                  {" of "}
                  {pagination.total} notifications
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <button
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={page === pagination.totalPages}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
