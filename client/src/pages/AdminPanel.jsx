import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  X,
  Sparkles,
  ClipboardList,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import TemplateBuilder from "../components/admin/TemplateBuilder.jsx";

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
    id: "policies",
    labelKey: "adminPanel.policies",
    descriptionKey: "adminPanel.policiesDesc",
    icon: Shield,
    iconBg: "bg-cyan-50 dark:bg-cyan-900/30",
    iconColor: "text-cyan-600 dark:text-cyan-400",
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
];

const AdminPanel = () => {
  const { t } = useTranslation();
  const [activeModule, setActiveModule] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

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

  const active = MODULES.find((m) => m.id === activeModule) || MODULES[0];
  const ActiveIcon = active.icon;

  const stats = [
    { label: t("adminPanel.totalUsers"), value: "—" },
    { label: t("adminPanel.activeOrgs"), value: "—" },
    { label: t("adminPanel.totalMeetings"), value: "—" },
    { label: t("adminPanel.pendingRequests"), value: "—" },
  ];

  const selectModule = (id) => {
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
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
                  {t("adminPanel.recentActivity")}
                </h3>
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  {t("adminPanel.noActivity")}
                </div>
              </div>
            </div>
          ) : activeModule === "templates" ? (
            <TemplateBuilder />
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
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                {t("adminPanel.comingSoon")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
