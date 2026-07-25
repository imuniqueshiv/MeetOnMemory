import React, { useState, useContext, useEffect } from "react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import {
  User,
  Mail,
  Building2,
  Shield,
  Bell,
  Palette,
  Globe,
  Clock,
  LogOut,
  Lock,
  ChevronRight,
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import CalendarIntegrations from "../components/CalendarIntegrations.jsx";
import useTheme from "../context/useTheme.jsx";
import WebhooksManager from "../components/WebhooksManager.jsx";

const Settings = () => {
  const { userData, logoutUser } = useContext(AppContent);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Calendar connection state
  const [calendarStatus, setCalendarStatus] = useState({
    google: null,
    microsoft: null,
  });
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Notification preferences state (UI only - no backend support)
  const [notificationPrefs, setNotificationPrefs] = useState({
    meetingNotifications: true,
    organizationUpdates: true,
    aiProcessingUpdates: true,
    emailNotifications: true,
  });

  const { theme, toggleTheme } = useTheme();

  // Fetch calendar connection status
  useEffect(() => {
    const fetchCalendarStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("/api/calendar/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCalendarStatus(response.data.status);
      } catch (error) {
        console.error("Error fetching calendar status:", error);
      }
    };

    if (userData) {
      fetchCalendarStatus();
    }
  }, [userData]);

  // Appearance preferences state (UI only - no backend support)
  const [appearancePrefs, setAppearancePrefs] = useState({
    theme: theme,
  });

  useEffect(() => {
    setAppearancePrefs((prev) => ({ ...prev, theme }));
  }, [theme]);

  // Preferences state (UI only - placeholders)
  const [generalPrefs, setGeneralPrefs] = useState({
    language: "en",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: "MM/DD/YYYY",
  });

  if (!userData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500 dark:text-blue-400" />
          <span className="ml-3 text-slate-500 dark:text-slate-400 font-medium">
            Loading settings...
          </span>
        </div>
      </div>
    );
  }

  const displayRole = userData.role
    ? userData.role.charAt(0).toUpperCase() +
      userData.role.slice(1).toLowerCase()
    : "Member";

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Failed to logout");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key) => {
    setNotificationPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleThemeChange = (newTheme) => {
    if (newTheme !== theme) {
      toggleTheme();
    }
  };

  // Calendar connection handlers
  const handleConnectGoogle = async () => {
    try {
      setCalendarLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/calendar/google/auth-url", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Open OAuth popup
      const authWindow = window.open(response.data.authUrl, "_blank", "width=500,height=600");
      
      // Poll for callback (in production, use a proper OAuth flow with redirect)
      const pollForCallback = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(pollForCallback);
          setCalendarLoading(false);
          // Refresh status
          fetchCalendarStatus();
        }
      }, 500);
    } catch (error) {
      console.error("Error connecting Google Calendar:", error);
      toast.error("Failed to connect Google Calendar");
      setCalendarLoading(false);
    }
  };

  const handleConnectMicrosoft = async () => {
    try {
      setCalendarLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/calendar/microsoft/auth-url", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Open OAuth popup
      const authWindow = window.open(response.data.authUrl, "_blank", "width=500,height=600");
      
      // Poll for callback
      const pollForCallback = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(pollForCallback);
          setCalendarLoading(false);
          // Refresh status
          fetchCalendarStatus();
        }
      }, 500);
    } catch (error) {
      console.error("Error connecting Microsoft Calendar:", error);
      toast.error("Failed to connect Microsoft Calendar");
      setCalendarLoading(false);
    }
  };

  const handleDisconnect = async (provider) => {
    try {
      setCalendarLoading(true);
      const token = localStorage.getItem("token");
      await axios.delete(`/api/calendar/${provider}/disconnect`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar disconnected`);
      // Refresh status
      const statusResponse = await axios.get("/api/calendar/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCalendarStatus(statusResponse.data.status);
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      toast.error("Failed to disconnect calendar");
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleResync = async (provider) => {
    try {
      setCalendarLoading(true);
      const token = localStorage.getItem("token");
      await axios.post(`/api/calendar/${provider}/resync`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar synced`);
      // Refresh status
      const statusResponse = await axios.get("/api/calendar/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCalendarStatus(statusResponse.data.status);
    } catch (error) {
      console.error("Error resyncing calendar:", error);
      toast.error("Failed to sync calendar");
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchCalendarStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/calendar/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCalendarStatus(response.data.status);
    } catch (error) {
      console.error("Error fetching calendar status:", error);
    }
  };

  const getConnectionStatusIcon = (connection) => {
    if (!connection) return <XCircle className="w-4 h-4 text-slate-400" />;
    if (connection.syncStatus === "connected") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (connection.syncStatus === "needs_reauth") return <XCircle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getConnectionStatusText = (connection) => {
    if (!connection) return "Not connected";
    if (connection.syncStatus === "connected") return "Connected";
    if (connection.syncStatus === "needs_reauth") return "Re-authentication required";
    if (connection.syncStatus === "syncing") return "Syncing...";
    return "Error";
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans select-none">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Page title header */}
        <div className="text-center mb-8 fade-in-up stagger-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-md mx-auto">
            Manage your account preferences, notifications, and security
            settings.
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Settings Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Account Settings
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  View and manage your account information
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Name
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                      {userData.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/profile")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Edit Profile
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Email
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 break-all">
                      {userData.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Organization
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                      {userData.organization?.name || "No Organization"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Role
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 capitalize">
                      {displayRole}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-3">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                <Palette className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Appearance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Customize your application theme
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Theme
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose your preferred theme
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      appearancePrefs.theme === "light"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      appearancePrefs.theme === "dark"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preferences Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Notification Preferences
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage how you receive notifications
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Meeting Notifications
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Get notified about meeting updates
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleNotificationChange("meetingNotifications")
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    notificationPrefs.meetingNotifications
                      ? "bg-blue-600"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  aria-pressed={notificationPrefs.meetingNotifications}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      notificationPrefs.meetingNotifications
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Organization Updates
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Updates about your organization
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleNotificationChange("organizationUpdates")
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    notificationPrefs.organizationUpdates
                      ? "bg-blue-600"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  aria-pressed={notificationPrefs.organizationUpdates}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      notificationPrefs.organizationUpdates
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    AI Processing Updates
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Notifications when AI processing completes
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleNotificationChange("aiProcessingUpdates")
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    notificationPrefs.aiProcessingUpdates
                      ? "bg-blue-600"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  aria-pressed={notificationPrefs.aiProcessingUpdates}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      notificationPrefs.aiProcessingUpdates
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Email Notifications
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Receive notifications via email
                  </p>
                </div>
                <button
                  onClick={() => handleNotificationChange("emailNotifications")}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    notificationPrefs.emailNotifications
                      ? "bg-blue-600"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  aria-pressed={notificationPrefs.emailNotifications}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      notificationPrefs.emailNotifications
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Integrations */}
          <CalendarIntegrations />
          {/* Calendar Integrations Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-xl">
                <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Calendar Integrations
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect your calendars for two-way sync
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Google Calendar */}
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getConnectionStatusIcon(calendarStatus.google)}
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                        Google Calendar
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {getConnectionStatusText(calendarStatus.google)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {calendarStatus.google?.syncStatus === "connected" && (
                    <button
                      onClick={() => handleResync("google")}
                      disabled={calendarLoading}
                      className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Resync"
                    >
                      <RefreshCw className={`w-4 h-4 ${calendarLoading ? "animate-spin" : ""}`} />
                    </button>
                  )}
                  {calendarStatus.google ? (
                    <button
                      onClick={() => handleDisconnect("google")}
                      disabled={calendarLoading}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={calendarLoading}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {/* Microsoft Calendar */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getConnectionStatusIcon(calendarStatus.microsoft)}
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                        Microsoft Outlook
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {getConnectionStatusText(calendarStatus.microsoft)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {calendarStatus.microsoft?.syncStatus === "connected" && (
                    <button
                      onClick={() => handleResync("microsoft")}
                      disabled={calendarLoading}
                      className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Resync"
                    >
                      <RefreshCw className={`w-4 h-4 ${calendarLoading ? "animate-spin" : ""}`} />
                    </button>
                  )}
                  {calendarStatus.microsoft ? (
                    <button
                      onClick={() => handleDisconnect("microsoft")}
                      disabled={calendarLoading}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectMicrosoft}
                      disabled={calendarLoading}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-xl">
                <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Security
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage your account security settings
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate("/reset-password")}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                      Change Password
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Update your password
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
              </button>

              <div className="w-full flex items-center justify-between py-3 px-4 rounded-xl opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                      Two-Factor Authentication
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Coming soon
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                  Soon
                </span>
              </div>

              <div className="w-full flex items-center justify-between py-3 px-4 rounded-xl opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                      Active Sessions
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Manage your active sessions
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                  Soon
                </span>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              <button
                onClick={handleLogout}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    Logout from current session
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-xl">
                <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Preferences
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure your application preferences
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Language
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select your preferred language
                  </p>
                </div>
                <select
                  value={generalPrefs.language}
                  onChange={(e) =>
                    setGeneralPrefs((prev) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Time Zone
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Set your time zone
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {generalPrefs.timeZone}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Date Format
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose your date format preference
                  </p>
                </div>
                <select
                  value={generalPrefs.dateFormat}
                  onChange={(e) =>
                    setGeneralPrefs((prev) => ({
                      ...prev,
                      dateFormat: e.target.value,
                    }))
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Webhooks Management Section */}
          {userData.organization && (
            <div className="pt-2 fade-in-up stagger-6">
              <WebhooksManager
                organizationId={
                  typeof userData.organization === "object"
                    ? userData.organization._id
                    : userData.organization
                }
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;
