import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserPlus,
  Calendar,
  Shield,
  BarChart3,
  Settings,
  Activity,
  Menu,
  ShieldAlert,
  X,
  Sparkles,
  ClipboardList,
  MessageSquareQuote,
  ExternalLink,
  Loader2,
  Clock,
  RefreshCw,
  ListTodo,
  Database,
  ShieldCheck,
  BrainCircuit,
  Cpu,
  Briefcase,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import TemplateBuilder from "../components/admin/TemplateBuilder.jsx";
import TestimonialsModeration from "../components/admin/TestimonialsModeration.jsx";
import JobsDashboard from "../components/admin/JobsDashboard.jsx";
import EmbeddingReindexAdmin from "../components/admin/EmbeddingReindexAdmin.jsx";
import CareersAdminQueue from "../components/admin/CareersAdminQueue.jsx";
import RbacPermissionExplorer from "../components/admin/RbacPermissionExplorer.jsx";
import ImportanceRecalculationAdmin from "../components/admin/ImportanceRecalculationAdmin.jsx";
import AiUsageMetrics from "../components/admin/AiUsageMetrics.jsx";
import MembershipRequests from "../components/organization/MembershipRequests.jsx";
import ResourceManagement from "./Admin/ResourceManagement.jsx";
import MemberWorkspace from "../components/admin/MemberWorkspace.jsx";
import MeetingWorkspace from "../components/admin/MeetingWorkspace.jsx";
import PolicyWorkspace from "../components/admin/PolicyWorkspace.jsx";

import AppContent from "../context/AppContent.js";
import { fetchPlatformStatus } from "../services/statusApi.js";
import {
  organizationApi,
  meetingApi,
  policyApi,
  membershipRequestApi,
  analyticsApi,
} from "../services";

const MODULES = [
  {
    id: "overview",
    labelKey: "adminPanel.overview",
    descriptionKey: "adminPanel.overviewDesc",
    icon: LayoutDashboard,
    iconBg: "bg-blue-50 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "organizations",
    labelKey: "adminPanel.organizations",
    descriptionKey: "adminPanel.organizationsDesc",
    icon: Building2,
    iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "members",
    labelKey: "adminPanel.members",
    descriptionKey: "adminPanel.membersDesc",
    icon: Users,
    iconBg: "bg-violet-50 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "joinRequests",
    labelKey: "adminPanel.joinRequests",
    descriptionKey: "adminPanel.joinRequestsDesc",
    icon: UserPlus,
    iconBg: "bg-amber-50 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "meetings",
    labelKey: "adminPanel.meetings",
    descriptionKey: "adminPanel.meetingsDesc",
    icon: Calendar,
    iconBg: "bg-rose-50 dark:bg-rose-900/30",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    id: "templates",
    labelKey: "Meeting Templates", // Fallback text instead of translation key
    descriptionKey: "Manage reusable meeting agenda templates",
    icon: ClipboardList,
    iconBg: "bg-fuchsia-50 dark:bg-fuchsia-900/30",
    iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
  },
  {
    id: "testimonials",
    labelKey: "Testimonials",
    descriptionKey: "Moderate public product ratings and comments",
    icon: MessageSquareQuote,
    iconBg: "bg-sky-50 dark:bg-sky-900/30",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "jobs",
    labelKey: "Jobs",
    descriptionKey: "Background queues, failures, and retries",
    icon: ListTodo,
    iconBg: "bg-teal-50 dark:bg-teal-900/30",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  {
    id: "embeddings",
    labelKey: "Embeddings",
    descriptionKey: "Pinecone index health and reindex actions",
    icon: Database,
    iconBg: "bg-cyan-50 dark:bg-cyan-900/30",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
  {
    id: "importance",
    labelKey: "Importance Score Engine",
    descriptionKey: "Trigger score recalculations and view job diagnostics",
    icon: BrainCircuit,
    iconBg: "bg-indigo-50 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "aiUsage",
    labelKey: "AI Usage",
    descriptionKey: "Gemini and embedding cost/usage over time",
    icon: Cpu,
    iconBg: "bg-violet-50 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "policies",
    labelKey: "adminPanel.policies",
    descriptionKey: "Organization security and data access rules",
    icon: ShieldAlert,
    iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    roles: ["admin", "owner", "compliance_officer"],
  },
  {
    id: "resources",
    labelKey: "Physical Resources",
    descriptionKey: "Manage meeting rooms and office hardware",
    icon: Building2,
    iconBg: "bg-blue-50 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    roles: ["admin", "owner"],
  },
  {
    id: "reports",
    labelKey: "adminPanel.reports",
    descriptionKey: "adminPanel.reportsDesc",
    icon: BarChart3,
    iconBg: "bg-indigo-50 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "settings",
    labelKey: "adminPanel.settings",
    descriptionKey: "adminPanel.settingsDesc",
    icon: Settings,
    iconBg: "bg-slate-100 dark:bg-slate-800",
    iconColor: "text-slate-600 dark:text-slate-300",
  },
  {
    id: "activity",
    labelKey: "adminPanel.activity",
    descriptionKey: "adminPanel.activityDesc",
    icon: Activity,
    iconBg: "bg-orange-50 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    id: "health",
    labelKey: "System Health",
    descriptionKey: "Live dependency statuses and system diagnostics",
    icon: Activity,
    iconBg: "bg-red-50 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  {
    id: "permissions",
    labelKey: "Permissions Matrix",
    descriptionKey: "Role × action permission matrix and access explainer",
    icon: ShieldCheck,
    iconBg: "bg-purple-50 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "careers",
    labelKey: "Careers Queue",
    descriptionKey: "Review job applications, set status, and record notes",
    icon: Briefcase,
    iconBg: "bg-indigo-50 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
];

const AdminPanel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userData } = useContext(AppContent) || {};
  const orgId = userData?.organization?._id || userData?.organization;

  const initialModule = (() => {
    const requested = searchParams.get("module");
    if (requested && MODULES.some((m) => m.id === requested)) return requested;
    return "overview";
  })();

  const [activeModule, setActiveModule] = useState(initialModule);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);
  const [redisDegraded, setRedisDegraded] = useState(false);

  useEffect(() => {
    const checkRedisStatus = async () => {
      try {
        const res = await fetchPlatformStatus();
        if (res.ok && res.data?.services) {
          const redisService = res.data.services.find((s) => s.id === "redis");
          if (
            redisService &&
            (redisService.status === "degraded" ||
              redisService.status === "outage" ||
              redisService.status === "unknown")
          ) {
            setRedisDegraded(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch status for Redis check", err);
      }
    };
    checkRedisStatus();
  }, []);

  // Overview Data
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewStats, setOverviewStats] = useState({
    totalUsers: null,
    activeOrgs: null,
    totalMeetings: null,
    pendingRequests: null,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  // Module Specific Data
  const [moduleData, setModuleData] = useState({
    members: [],
    organizations: [],
    meetings: [],
    policies: [],
    auditLogs: [],
    reports: null,
    settings: null,
  });
  const [loadingModule, setLoadingModule] = useState(false);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        !e.target?.closest?.("button[aria-label='Toggle sidebar']")
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fetch Overview Data
  const fetchOverviewData = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [membersRes, orgsRes, meetingsRes, requestsRes, auditRes] =
        await Promise.allSettled([
          organizationApi.getMembers(),
          organizationApi.getUserOrganizations(),
          meetingApi.getAllMeetings(),
          orgId
            ? membershipRequestApi.getOrganizationRequests(orgId, "pending")
            : Promise.resolve({ data: { requests: [] } }),
          orgId
            ? organizationApi.getAuditLogs(orgId, { limit: 5 })
            : Promise.resolve({ data: { logs: [] } }),
        ]);

      setOverviewStats({
        totalUsers:
          membersRes.status === "fulfilled" && membersRes.value.data?.members
            ? membersRes.value.data.members.length
            : membersRes.status === "fulfilled" &&
                membersRes.value.data?.success
              ? 0
              : null,
        activeOrgs:
          orgsRes.status === "fulfilled" && orgsRes.value.data?.organizations
            ? orgsRes.value.data.organizations.length
            : orgsRes.status === "fulfilled" && orgsRes.value.data?.success
              ? 1
              : null,
        totalMeetings:
          meetingsRes.status === "fulfilled" &&
          (meetingsRes.value.data?.meetings ||
            meetingsRes.value.data?.total !== undefined)
            ? (meetingsRes.value.data.meetings?.length ??
              meetingsRes.value.data.total ??
              0)
            : meetingsRes.status === "fulfilled" &&
                meetingsRes.value.data?.success
              ? 0
              : null,
        pendingRequests:
          requestsRes.status === "fulfilled" && requestsRes.value.data?.requests
            ? requestsRes.value.data.requests.length
            : requestsRes.status === "fulfilled" &&
                requestsRes.value.data?.success
              ? 0
              : null,
      });

      if (auditRes.status === "fulfilled" && auditRes.value.data?.logs) {
        setRecentActivity(auditRes.value.data.logs.slice(0, 5));
      }
    } catch (err) {
      console.error("Failed to load admin overview data", err);
    } finally {
      setLoadingOverview(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Fetch Module Specific Data
  useEffect(() => {
    if (
      activeModule === "overview" ||
      activeModule === "templates" ||
      activeModule === "testimonials" ||
      activeModule === "jobs" ||
      activeModule === "embeddings" ||
      activeModule === "importance" ||
      activeModule === "aiUsage" ||
      activeModule === "joinRequests"
    ) {
      return;
    }

    const fetchModuleData = async () => {
      setLoadingModule(true);
      try {
        if (activeModule === "members") {
          const res = await organizationApi.getMembers();
          if (res.data?.members) {
            setModuleData((prev) => ({ ...prev, members: res.data.members }));
          }
        } else if (activeModule === "organizations") {
          const res = await organizationApi.getUserOrganizations();
          if (res.data?.organizations) {
            setModuleData((prev) => ({
              ...prev,
              organizations: res.data.organizations,
            }));
          }
        } else if (activeModule === "meetings") {
          const res = await meetingApi.getAllMeetings();
          if (res.data?.meetings) {
            setModuleData((prev) => ({ ...prev, meetings: res.data.meetings }));
          }
        } else if (activeModule === "policies") {
          const res = await policyApi.getPolicies();
          if (res.data?.policies) {
            setModuleData((prev) => ({ ...prev, policies: res.data.policies }));
          }
        } else if (activeModule === "activity") {
          if (orgId) {
            const res = await organizationApi.getAuditLogs(orgId, {
              limit: 20,
            });
            if (res.data?.logs) {
              setModuleData((prev) => ({ ...prev, auditLogs: res.data.logs }));
            }
          }
        } else if (activeModule === "reports") {
          const res = await analyticsApi.getAnalytics();
          if (res.data) {
            setModuleData((prev) => ({ ...prev, reports: res.data }));
          }
        } else if (activeModule === "settings") {
          if (orgId) {
            const res = await organizationApi.getOrganizationSettings(orgId);
            if (res.data?.organization || res.data?.settings) {
              setModuleData((prev) => ({
                ...prev,
                settings: res.data.organization || res.data.settings,
              }));
            }
          }
        }
      } catch (err) {
        console.error(`Failed to load data for ${activeModule}`, err);
      } finally {
        setLoadingModule(false);
      }
    };

    fetchModuleData();
  }, [activeModule, orgId]);

  const active = MODULES.find((m) => m.id === activeModule) || MODULES[0];
  const ActiveIcon = active.icon;

  const stats = [
    {
      label: t("adminPanel.totalUsers"),
      value: loadingOverview
        ? "—"
        : overviewStats.totalUsers !== null
          ? overviewStats.totalUsers
          : "0",
    },
    {
      label: t("adminPanel.activeOrgs"),
      value: loadingOverview
        ? "—"
        : overviewStats.activeOrgs !== null
          ? overviewStats.activeOrgs
          : "1",
    },
    {
      label: t("adminPanel.totalMeetings"),
      value: loadingOverview
        ? "—"
        : overviewStats.totalMeetings !== null
          ? overviewStats.totalMeetings
          : "0",
    },
    {
      label: t("adminPanel.pendingRequests"),
      value: loadingOverview
        ? "—"
        : overviewStats.pendingRequests !== null
          ? overviewStats.pendingRequests
          : "0",
    },
  ];

  const selectModule = (id) => {
    if (id === "health") {
      navigate("/admin/health");
      return;
    }
    setActiveModule(id);
    setSidebarOpen(false);
  };

  const sidebarNav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Admin modules">
      {MODULES.map((mod) => {
        const Icon = mod.icon;
        const isActive = activeModule === mod.id;
        return (
          <button
            key={mod.id}
            type="button"
            onClick={() => selectModule(mod.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left cursor-pointer ${
              isActive
                ? `${mod.iconBg} ${mod.iconColor}`
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {mod.labelKey.includes(".") ? t(mod.labelKey) : mod.labelKey}
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col">
      <Navbar />

      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          className={`fixed lg:relative inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0 pt-16" : "-translate-x-full pt-16"
          } lg:pt-0`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {t("adminPanel.title")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {sidebarNav}
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden cursor-pointer"
            aria-label="Close sidebar overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6">
          {redisDegraded && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-sm rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div>
                  <strong className="font-bold">
                    Redis Cache & Real-Time Support is Degraded:
                  </strong>{" "}
                  Rate limiting fallback is active and real-time features may
                  experience lag or cache misses.
                </div>
              </div>
              <a
                href="https://docs.meetonmemory.com/redis-setup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline shrink-0 whitespace-nowrap"
              >
                Enable Redis in Docs →
              </a>
            </div>
          )}
          <div className="flex items-start gap-3 mb-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${active.iconBg}`}
                >
                  <ActiveIcon className={`w-5 h-5 ${active.iconColor}`} />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {active.labelKey.includes(".")
                    ? t(active.labelKey)
                    : active.labelKey}
                </h1>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {active.descriptionKey.includes(".")
                  ? t(active.descriptionKey)
                  : active.descriptionKey}
              </p>
            </div>
          </div>

          {activeModule === "overview" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t("adminPanel.recentActivity")}
                  </h3>
                  <button
                    type="button"
                    onClick={fetchOverviewData}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                </div>

                {recentActivity.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentActivity.map((log, idx) => (
                      <div
                        key={log._id || idx}
                        className="py-3 flex items-center justify-between gap-4 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Activity className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {log.action?.replace(/_/g, " ") || "Admin Action"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {log.user?.name || log.user?.email || "System"} •{" "}
                              {log.details ||
                                log.targetType ||
                                "Action recorded"}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    {t("adminPanel.noActivity")}
                  </div>
                )}
              </div>
            </div>
          ) : activeModule === "resources" ? (
            <ResourceManagement />
          ) : activeModule === "careers" ? (
            <CareersAdminQueue />
          ) : activeModule === "templates" ? (
            <TemplateBuilder />
          ) : activeModule === "testimonials" ? (
            <TestimonialsModeration />
          ) : activeModule === "jobs" ? (
            <JobsDashboard />
          ) : activeModule === "embeddings" ? (
            <EmbeddingReindexAdmin />
          ) : activeModule === "permissions" ? (
            <RbacPermissionExplorer />
          ) : activeModule === "importance" ? (
            <ImportanceRecalculationAdmin />
          ) : activeModule === "aiUsage" ? (
            <AiUsageMetrics />
          ) : activeModule === "joinRequests" ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <MembershipRequests organizationId={orgId} />
            </div>
          ) : activeModule === "members" ? (
            <MemberWorkspace
              members={moduleData.members}
              orgId={orgId}
              loading={loadingModule}
              onRefresh={() => {
                organizationApi.getMembers().then((res) => {
                  if (res.data?.members) {
                    setModuleData((prev) => ({
                      ...prev,
                      members: res.data.members,
                    }));
                  }
                });
              }}
              isAdmin={
                userData?.role === "admin" ||
                userData?.role === "owner" ||
                userData?.role === "superadmin"
              }
            />
          ) : activeModule === "organizations" ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Organizations
                </h3>
                <button
                  type="button"
                  onClick={() => navigate("/organizations/browse")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
                >
                  <span>Browse All</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingModule ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : moduleData.organizations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {moduleData.organizations.map((org) => (
                    <div
                      key={org._id || org.id}
                      className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {org.name}
                        </h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Slug: {org.slug || "—"}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        {org.role || "Active"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                  No organizations found.
                </div>
              )}
            </div>
          ) : activeModule === "meetings" ? (
            <MeetingWorkspace
              meetings={moduleData.meetings}
              loading={loadingModule}
              onRefresh={() => {
                meetingApi.getAllMeetings().then((res) => {
                  if (res.data?.meetings) {
                    setModuleData((prev) => ({
                      ...prev,
                      meetings: res.data.meetings,
                    }));
                  }
                });
              }}
              onOpenEmbeddings={() => selectModule("embeddings")}
              isAdmin={
                userData?.role === "admin" ||
                userData?.role === "owner" ||
                userData?.role === "superadmin"
              }
            />
          ) : activeModule === "policies" ? (
            <PolicyWorkspace
              policies={moduleData.policies}
              loading={loadingModule}
              onRefresh={() => {
                policyApi.getPolicies().then((res) => {
                  if (res.data?.policies) {
                    setModuleData((prev) => ({
                      ...prev,
                      policies: res.data.policies,
                    }));
                  }
                });
              }}
              isAdmin={
                userData?.role === "admin" ||
                userData?.role === "owner" ||
                userData?.role === "superadmin"
              }
            />
          ) : activeModule === "reports" ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Reports & Analytics Hub
                </h3>
                <button
                  type="button"
                  onClick={() => navigate("/reports")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer"
                >
                  <span>Open Full Reports</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div
                  onClick={() => navigate("/attendance-analytics")}
                  className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors"
                >
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                    Attendance Analytics
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Track participant engagement and attendance trends.
                  </p>
                </div>
                <div
                  onClick={() => navigate("/meeting-cost-analytics")}
                  className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors"
                >
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                    Meeting Cost Analytics
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Analyze time and financial investment in meetings.
                  </p>
                </div>
                <div
                  onClick={() => navigate("/leaderboard")}
                  className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors"
                >
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                    Hygiene Leaderboard
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Gamified scores and badges for meeting hygiene.
                  </p>
                </div>
              </div>
            </div>
          ) : activeModule === "settings" ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Organization Settings
                </h3>
                <button
                  type="button"
                  onClick={() => navigate("/organization/settings")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <span>Configure Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Organization: {userData?.organization?.name || "Default Org"}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Role: {userData?.role || "Member"}
                </p>
              </div>
            </div>
          ) : activeModule === "activity" ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Administrative Audit Logs
                </h3>
                <button
                  type="button"
                  onClick={() => navigate("/admin/audit-logs")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 cursor-pointer"
                >
                  <span>Open Audit Log Viewer</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingModule ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                </div>
              ) : moduleData.auditLogs.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {moduleData.auditLogs.map((log, idx) => (
                    <div
                      key={log._id || idx}
                      className="py-3 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {log.action?.replace(/_/g, " ") || "Admin Action"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {log.user?.name || log.user?.email || "System"} •{" "}
                          {log.details || log.targetType || "Action recorded"}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {log.createdAt
                          ? new Date(log.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                  No activity logs found.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center">
              <div
                className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${active.iconBg}`}
              >
                <ActiveIcon className={`w-7 h-7 ${active.iconColor}`} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {active.labelKey.includes(".")
                  ? t(active.labelKey)
                  : active.labelKey}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md mx-auto">
                {active.descriptionKey.includes(".")
                  ? t(active.descriptionKey)
                  : active.descriptionKey}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
