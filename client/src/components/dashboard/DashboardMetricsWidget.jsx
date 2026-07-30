import React, { useEffect, useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Clock, Bell, CalendarDays, AlertCircle } from "lucide-react";
import AppContent from "../../context/AppContent";
import axios from "axios";

const DashboardMetricsWidget = () => {
  const { t } = useTranslation();
  const { backendUrl, isLoggedin, userData } = useContext(AppContent);
  const [metrics, setMetrics] = useState({
    overdueTasks: 0,
    unreadNotifications: 0,
    upcomingMeetings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchMetrics = async () => {
      if (!isLoggedin || !userData?.organization) return;

      try {
        setLoading(true);
        axios.defaults.withCredentials = true;
        const response = await axios.get(`${backendUrl}/api/dashboard/metrics`);
        if (response.data.success && isMounted) {
          setMetrics(response.data.metrics);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard metrics", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMetrics();
    return () => {
      isMounted = false;
    };
  }, [backendUrl, isLoggedin, userData]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-slate-200 dark:bg-gray-800 rounded-xl h-24 border border-slate-300 dark:border-gray-700"
          ></div>
        ))}
      </div>
    );
  }

  const items = [
    {
      id: "overdue",
      label: t("dashboard.metrics.overdueTasks", "Overdue Action Items"),
      value: metrics.overdueTasks,
      icon: Clock,
      color:
        metrics.overdueTasks > 0
          ? "text-red-600 dark:text-red-400"
          : "text-slate-600 dark:text-gray-400",
      bg:
        metrics.overdueTasks > 0
          ? "bg-red-50 dark:bg-red-900/20"
          : "bg-slate-50 dark:bg-gray-800",
      border:
        metrics.overdueTasks > 0
          ? "border-red-200 dark:border-red-800"
          : "border-slate-200 dark:border-gray-700",
      link: "/action-items",
    },
    {
      id: "unread",
      label: t("dashboard.metrics.unreadNotifications", "Unread Notifications"),
      value: metrics.unreadNotifications,
      icon: Bell,
      color:
        metrics.unreadNotifications > 0
          ? "text-amber-600 dark:text-amber-400"
          : "text-slate-600 dark:text-gray-400",
      bg:
        metrics.unreadNotifications > 0
          ? "bg-amber-50 dark:bg-amber-900/20"
          : "bg-slate-50 dark:bg-gray-800",
      border:
        metrics.unreadNotifications > 0
          ? "border-amber-200 dark:border-amber-800"
          : "border-slate-200 dark:border-gray-700",
      link: "/notifications",
    },
    {
      id: "upcoming",
      label: t("dashboard.metrics.upcomingMeetings", "Upcoming Meetings"),
      value: metrics.upcomingMeetings,
      icon: CalendarDays,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200 dark:border-blue-800",
      link: "/create-meeting",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 fade-in-up stagger-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            to={item.link}
            key={item.id}
            className={`flex items-center gap-4 p-5 rounded-xl border ${item.border} ${item.bg} hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group`}
          >
            <div
              className={`p-3 rounded-lg bg-white/60 dark:bg-gray-900/50 ${item.color}`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {item.value}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-400 mt-0.5">
                {item.label}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default DashboardMetricsWidget;
