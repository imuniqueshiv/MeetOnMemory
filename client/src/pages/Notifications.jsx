import React, { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppContent from "../context/AppContent";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import { notificationApi } from "../services";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Calendar,
  FileText,
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
} from "lucide-react";

// Issue #977: `tasks` is a new category. Action-item reminders were previously
// filed under `meetings`, which meant the "Task assignments" preference toggle
// governed nothing while the "Meeting reminders" toggle silently killed task
// reminders.
const CATEGORY_ICONS = {
  meetings: Calendar,
  tasks: ListChecks,
  ai_processing: Brain,
  organizations: Building2,
  policies: Shield,
  reports: BarChart3,
  system: AlertCircle,
};

const CATEGORY_COLORS = {
  meetings: "bg-blue-50 text-blue-600 border-blue-200",
  tasks: "bg-teal-50 text-teal-600 border-teal-200",
  ai_processing: "bg-violet-50 text-violet-600 border-violet-200",
  organizations: "bg-emerald-50 text-emerald-600 border-emerald-200",
  policies: "bg-amber-50 text-amber-600 border-amber-200",
  reports: "bg-indigo-50 text-indigo-600 border-indigo-200",
  system: "bg-slate-50 text-slate-600 border-slate-200",
};

const CATEGORY_LABELS = {
  meetings: "Meetings",
  tasks: "Tasks",
  ai_processing: "AI Processing",
  organizations: "Organizations",
  policies: "Policies",
  reports: "Reports",
  system: "System",
};

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

const Notifications = () => {
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 20 };
      if (filter !== "all") params.status = filter;
      if (categoryFilter !== "all") params.category = categoryFilter;

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
  }, [filter, categoryFilter, page]);

  useEffect(() => {
    if (userData) {
      setPage(1);
    }
  }, [userData, filter, categoryFilter]);

  useEffect(() => {
    if (userData) {
      fetchNotifications();
    }
  }, [userData, fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      const { data } = await notificationApi.markAsRead(id);

      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        toast.success("Marked as read");
      }
    } catch (err) {
      console.error("Error marking as read:", err);
      toast.error("Failed to mark as read");
    }
  };

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

  const handleDelete = async (id) => {
    try {
      const { data } = await notificationApi.deleteNotification(id);

      if (data.success) {
        setNotifications((prev) => {
          const deleted = prev.find((n) => n.id === id);
          const newCount =
            deleted && !deleted.isRead ? unreadCount - 1 : unreadCount;
          setUnreadCount(Math.max(0, newCount));
          return prev.filter((n) => n.id !== id);
        });
        toast.success("Notification deleted");
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
      toast.error("Failed to delete notification");
    }
  };

  const handleActionClick = (notification) => {
    if (notification.actionUrl) {
      if (!notification.isRead) {
        handleMarkAsRead(notification.id);
      }
      navigate(notification.actionUrl);
    }
  };

  const filteredNotifications = notifications;

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 sm:pb-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Stay updated with your activity and alerts
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
            <Filter className="w-4 h-4 text-slate-400 ml-2" />
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === "unread"
                  ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilter("read")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === "read"
                  ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              Read
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 overflow-x-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-transparent text-slate-900 dark:text-slate-200 border-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="meetings">Meetings</option>
              <option value="ai_processing">AI Processing</option>
              <option value="organizations">Organizations</option>
              <option value="policies">Policies</option>
              <option value="reports">Reports</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-slate-600">{error}</p>
            <button
              onClick={fetchNotifications}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No notifications
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm">
              {filter === "unread" || categoryFilter !== "all"
                ? "No notifications match your current filters."
                : "You're all caught up! We'll notify you when something new happens."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const Icon = CATEGORY_ICONS[notification.category] || AlertCircle;
              const categoryColor =
                CATEGORY_COLORS[notification.category] ||
                CATEGORY_COLORS.system;

              return (
                <div
                  key={notification.id}
                  className={`relative group rounded-xl border p-4 sm:p-5 transition-all duration-200 ${
                    !notification.isRead
                      ? "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${categoryColor}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!notification.isRead && (
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-600"></span>
                          )}
                          <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                            {notification.title}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${categoryColor}`}
                          >
                            {CATEGORY_LABELS[notification.category] || "System"}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                        {notification.description}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {notification.actionUrl && (
                          <button
                            onClick={() => handleActionClick(notification)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            {notification.actionLabel || "View"}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {!notification.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                          >
                            <Check className="w-3 h-3" />
                            Mark as read
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 pb-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
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
                    disabled={pagination.page <= 1}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from(
                      { length: pagination.totalPages },
                      (_, i) => i + 1,
                    )
                      .filter((p) => {
                        const total = pagination.totalPages;
                        const current = pagination.page;
                        if (total <= 7) return true;
                        if (p === 1 || p === total) return true;
                        if (Math.abs(p - current) <= 1) return true;
                        return false;
                      })
                      .map((p, idx, arr) => {
                        const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && (
                              <span className="px-1 text-slate-400">...</span>
                            )}
                            <button
                              onClick={() => setPage(p)}
                              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                pagination.page === p
                                  ? "bg-blue-600 text-white"
                                  : "text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Notifications;
