import React, { useState, useContext, useEffect, useRef } from "react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
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
} from "lucide-react";
import CalendarIntegrations from "../components/CalendarIntegrations.jsx";
import useTheme from "../context/useTheme.jsx";
import usePreferences from "../context/usePreferences.jsx";
import WebhooksManager from "../components/WebhooksManager.jsx";
import { LANGUAGES } from "../constants/languages.js";
import { DATE_FORMATS } from "../utils/dateFormat.js";
import DigestPreferences from "../components/DigestPreferences.jsx";
import RecapPreferences from "../components/RecapPreferences.jsx";
import { ClerkManageAccountButton } from "../components/ClerkUserControls.jsx";
import KeywordWatchlistPanel from "../components/notifications/KeywordWatchlistPanel.jsx";
import apiClient from "../services/apiClient.js";
import { notificationApi } from "../services/notificationApi.js";
import { userApi } from "../services/userApi.js";
import {
  validateCalendarOAuthAuthUrl,
  CALENDAR_OAUTH_FALLBACK_PATH,
} from "../utils/validateCalendarOAuthRedirect.js";
import { validateRedirect } from "../utils/validateRedirect.js";
import { usePolling } from "../hooks/usePolling.js";
import PushNotificationManager from "../components/notifications/PushNotificationManager.jsx";
import PwaInstallButton from "../components/pwa/PwaInstallButton.jsx";
import DataExportSection from "../components/settings/DataExportSection.jsx";
import ClerkSecuritySection from "../components/settings/ClerkSecuritySection.jsx";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * How long to watch a calendar OAuth popup before giving up (Issue #1455).
 *
 * Generous, because the user is working through a consent screen — but not
 * unbounded, so a popup left open and forgotten cannot poll for the lifetime
 * of the tab. The previous code had no deadline at all.
 */
const CALENDAR_OAUTH_POLL_TIMEOUT_MS = 5 * 60 * 1000;

/** Map NotificationPreference document fields → Settings toggle keys. */
const prefsFromApi = (preferences, emailDigestEnabled) => ({
  meetingNotifications: preferences?.pushMeetingReminders !== false,
  organizationUpdates: preferences?.pushOrganizationUpdates !== false,
  aiProcessingUpdates: preferences?.pushAiProcessingComplete !== false,
  emailNotifications:
    preferences?.emailMeetingReminders !== false &&
    preferences?.emailTaskAssignments !== false,
  emailDigestEnabled: emailDigestEnabled !== false,
});

/** Map a Settings toggle change → NotificationPreference allowlisted fields. */
const apiPayloadForToggle = (key, value) => {
  switch (key) {
    case "meetingNotifications":
      return { pushMeetingReminders: value };
    case "organizationUpdates":
      return { pushOrganizationUpdates: value };
    case "aiProcessingUpdates":
      return { pushAiProcessingComplete: value };
    case "emailNotifications":
      return {
        emailMeetingReminders: value,
        emailTaskAssignments: value,
      };
    default:
      return null;
  }
};

const Settings = () => {
  const { userData, setUserData, logoutUser } = useContext(AppContent);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Calendar connection state
  const [calendarStatus, setCalendarStatus] = useState({
    google: null,
    microsoft: null,
  });
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Owns the OAuth popup watcher, including its teardown on unmount (#1455).
  const { startPolling } = usePolling();

  const [notificationPrefs, setNotificationPrefs] = useState({
    meetingNotifications: true,
    organizationUpdates: true,
    aiProcessingUpdates: true,
    emailNotifications: true,
    emailDigestEnabled: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  // Serialize preference writes so rapid toggles cannot race on the server.
  const prefsSaveChainRef = useRef(Promise.resolve());
  const latestIntentRef = useRef({});

  const { theme, toggleTheme } = useTheme();

  // Fetch calendar connection status
  useEffect(() => {
    const fetchCalendarStatus = async () => {
      try {
        const response = await apiClient.get("/api/calendar/status");
        setCalendarStatus(
          response.data.status || { google: null, microsoft: null },
        );
      } catch (error) {
        console.error("Error fetching calendar status:", error);
      }
    };

    if (userData) {
      fetchCalendarStatus();
    }
  }, [userData]);

  // Load persisted notification preferences (Issue #1137)
  useEffect(() => {
    if (!userData?.id) return;

    let cancelled = false;

    const loadPreferences = async () => {
      setPrefsLoading(true);
      try {
        const response = await notificationApi.getPreferences();
        if (cancelled) return;
        setNotificationPrefs(
          prefsFromApi(response.data.preferences, userData.emailDigestEnabled),
        );
      } catch (error) {
        console.error("Error loading notification preferences:", error);
        if (!cancelled) {
          setNotificationPrefs(prefsFromApi(null, userData.emailDigestEnabled));
          toast.error("Failed to load notification preferences");
        }
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    };

    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [userData?.id, userData?.emailDigestEnabled]);

  // Appearance preferences state (UI only - no backend support)
  const [appearancePrefs, setAppearancePrefs] = useState({
    theme: theme,
  });

  useEffect(() => {
    setAppearancePrefs((prev) => ({ ...prev, theme }));
  }, [theme]);

  // Language + date format now come from the shared PreferencesContext,
  // the same one the Navbar LanguageSwitcher reads from - so both stay
  // in sync and the choice actually persists (localStorage) and applies
  // (i18n.changeLanguage) instead of being a disconnected UI mock.
  const { language, setLanguage, dateFormat, setDateFormat } = usePreferences();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
    const previousValue = notificationPrefs[key];
    const newValue = !previousValue;

    latestIntentRef.current[key] = newValue;
    setNotificationPrefs((prev) => ({
      ...prev,
      [key]: newValue,
    }));

    prefsSaveChainRef.current = prefsSaveChainRef.current
      .catch(() => {})
      .then(async () => {
        try {
          if (key === "emailDigestEnabled") {
            const response = await userApi.updateProfile({
              name: userData.name,
              profilePic: userData.profilePic || "",
              bio: userData.bio || "",
              emailDigestEnabled: newValue,
            });
            if (latestIntentRef.current[key] !== newValue) return;
            if (response.data?.user && setUserData) {
              setUserData(response.data.user);
            }
            toast.success("Email digest preference updated");
            return;
          }

          const payload = apiPayloadForToggle(key, newValue);
          if (!payload) return;

          await notificationApi.updatePreferences(payload);
          if (latestIntentRef.current[key] !== newValue) return;
          toast.success("Notification preference updated");
        } catch (error) {
          console.error("Error updating preference:", error);
          if (latestIntentRef.current[key] !== newValue) return;
          toast.error(
            error.response?.data?.message || "Failed to update preference",
          );
          setNotificationPrefs((prev) => ({
            ...prev,
            [key]: previousValue,
          }));
          latestIntentRef.current[key] = previousValue;
        }
      });
  };

  const handleThemeChange = (newTheme) => {
    if (newTheme !== theme) {
      toggleTheme();
    }
  };

  /**
   * Opens a provider's OAuth popup and waits for the user to finish with it.
   *
   * The Google and Microsoft handlers were identical apart from three strings,
   * and both carried the same two defects (Issue #1455):
   *
   *   - `window.open` returns `null` when a popup blocker intervenes, which is
   *     the common case here because the popup is opened *after* an `await` and
   *     the user-gesture token has already been spent on the auth-url request.
   *     `authWindow.closed` then threw a TypeError — and the only
   *     `clearInterval` sat inside the branch that had just thrown, so it threw
   *     again every 500 ms for the rest of the session, with the spinner stuck
   *     on because `setCalendarLoading(false)` was in that same branch.
   *
   *   - There was no deadline and no unmount teardown, so even a successful
   *     flow left a timer running if the user navigated away first.
   *
   * The blocked-popup case is now detected before any timer exists, and
   * `usePolling` owns the rest.
   *
   * @param {"google"|"microsoft"} provider
   * @param {string} label human-readable name used in messages
   */
  const connectCalendarProvider = async (provider, label) => {
    try {
      setCalendarLoading(true);
      const response = await apiClient.get(
        `/api/calendar/${provider}/auth-url`,
      );
      const safeAuthUrl = validateCalendarOAuthAuthUrl(response.data.authUrl);

      if (!safeAuthUrl) {
        toast.error(`Invalid ${label} Calendar authorization URL`);
        setCalendarLoading(false);
        window.location.assign(
          validateRedirect(CALENDAR_OAUTH_FALLBACK_PATH, "/settings"),
        );
        return;
      }

      // Open OAuth popup
      const authWindow = window.open(
        safeAuthUrl,
        "_blank",
        "width=500,height=600",
      );

      if (!authWindow) {
        toast.error(
          `Could not open the ${label} sign-in window. Please allow pop-ups for this site and try again.`,
        );
        setCalendarLoading(false);
        return;
      }

      // Poll until the user closes the popup. The deadline is long because the
      // user is filling in a consent screen, but it exists so a popup left open
      // and forgotten does not poll for the lifetime of the tab.
      startPolling(
        () => {
          if (!authWindow.closed) return false;

          setCalendarLoading(false);
          fetchCalendarStatus();
          return true;
        },
        {
          intervalMs: 500,
          timeoutMs: CALENDAR_OAUTH_POLL_TIMEOUT_MS,
          onTimeout: () => setCalendarLoading(false),
        },
      );
    } catch (error) {
      console.error(`Error connecting ${label} Calendar:`, error);
      toast.error(`Failed to connect ${label} Calendar`);
      setCalendarLoading(false);
    }
  };

  // Calendar connection handlers
  const handleConnectGoogle = () => connectCalendarProvider("google", "Google");

  const handleConnectMicrosoft = () =>
    connectCalendarProvider("microsoft", "Microsoft");

  const handleDisconnect = async (provider) => {
    try {
      setCalendarLoading(true);
      await apiClient.delete(`/api/calendar/${provider}/disconnect`);
      toast.success(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar disconnected`,
      );
      // Refresh status
      const statusResponse = await apiClient.get("/api/calendar/status");
      setCalendarStatus(
        statusResponse.data.status || { google: null, microsoft: null },
      );
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
      await apiClient.post(`/api/calendar/${provider}/resync`);
      toast.success(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar synced`,
      );
      // Refresh status
      const statusResponse = await apiClient.get("/api/calendar/status");
      setCalendarStatus(
        statusResponse.data.status || { google: null, microsoft: null },
      );
    } catch (error) {
      console.error("Error resyncing calendar:", error);
      toast.error("Failed to sync calendar");
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchCalendarStatus = async () => {
    try {
      const response = await apiClient.get("/api/calendar/status");
      setCalendarStatus(response.data.status);
    } catch (error) {
      console.error("Error fetching calendar status:", error);
    }
  };

  const getConnectionStatusIcon = (connection) => {
    if (!connection) return <XCircle className="w-4 h-4 text-slate-400" />;
    if (connection.syncStatus === "connected")
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (connection.syncStatus === "needs_reauth")
      return <XCircle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getConnectionStatusText = (connection) => {
    if (!connection) return "Not connected";
    if (connection.syncStatus === "connected") return "Connected";
    if (connection.syncStatus === "needs_reauth")
      return "Re-authentication required";
    if (connection.syncStatus === "syncing") return "Syncing...";
    return "Error";
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
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

        {/* PWA Install Banner */}
        <PwaInstallButton variant="banner" className="mb-6" />

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
                {userData.organization && (
                  <button
                    onClick={() => navigate("/organization/settings")}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    Org Settings
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
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

          {/* Availability Settings Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-3">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Availability Preferences
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage weekly hours and find slot heatmaps
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Team Availability & Heatmaps
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure your working hours and view team availability
                  </p>
                </div>
                <button
                  onClick={() => navigate("/team-availability")}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Manage Availability
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Language & Translation Preferences Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-3">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Language & Translation
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage primary language, live transcription translation, and
                  glossaries
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Language Preferences & Translation
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure default meeting languages, glossary mappings, and
                    translation quality
                  </p>
                </div>
                <button
                  onClick={() => navigate("/settings/language")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Manage Languages
                  <ChevronRight className="w-3 h-3" />
                </button>
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
              {prefsLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-500 dark:text-slate-400">
                  <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  <span className="text-sm">Loading preferences...</span>
                </div>
              ) : (
                <>
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
                      type="button"
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
                      type="button"
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
                      type="button"
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
                        Receive meeting reminders, digests, and action item
                        emails
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleNotificationChange("emailNotifications")
                      }
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

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                        Receive email digest after meetings
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Get an automated summary of completed meetings
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleNotificationChange("emailDigestEnabled")
                      }
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        notificationPrefs.emailDigestEnabled
                          ? "bg-blue-600"
                          : "bg-slate-200 dark:bg-slate-700"
                      }`}
                      aria-pressed={notificationPrefs.emailDigestEnabled}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                          notificationPrefs.emailDigestEnabled
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Web Push Notifications Section */}
          <div className="fade-in-up stagger-4">
            <PushNotificationManager />
          </div>

          {/* Keyword Watchlist Section */}
          <div className="fade-in-up stagger-4">
            <KeywordWatchlistPanel />
          </div>

          {/* Email Digest Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Email Digest
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure your email digest schedule and content
                </p>
              </div>
            </div>
            <DigestPreferences />
          </div>

          {/* Meeting Recaps Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm fade-in-up stagger-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Meeting Recaps
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure automatic email recaps for processed meetings
                </p>
              </div>
            </div>
            <RecapPreferences />
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
                      <RefreshCw
                        className={`w-4 h-4 ${calendarLoading ? "animate-spin" : ""}`}
                      />
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
                      <RefreshCw
                        className={`w-4 h-4 ${calendarLoading ? "animate-spin" : ""}`}
                      />
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
              {clerkPubKey && clerkPubKey.trim().length > 0 ? (
                <ClerkManageAccountButton className="w-full flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                        Manage account security
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Password, email, and connected accounts via Clerk
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                </ClerkManageAccountButton>
              ) : (
                <div className="w-full flex items-center justify-between py-3 px-4 rounded-xl opacity-60">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                        Account security
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Configure VITE_CLERK_PUBLISHABLE_KEY to manage security
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <ClerkSecuritySection />

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

          {/* Privacy & GDPR Data Export Section */}
          <div className="fade-in-up stagger-5">
            <DataExportSection />
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
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
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
                    {timeZone}
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
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {DATE_FORMATS.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {fmt}
                    </option>
                  ))}
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
      </div>
    </div>
  );
};

export default Settings;
