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
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";

const MODULES = [
  {
    id: "overview",
    labelKey: "adminPanel.overview",
    icon: LayoutDashboard,
    descriptionKey: "adminPanel.overviewDesc",
    color: "blue",
  },
  {
    id: "organizations",
    labelKey: "adminPanel.organizations",
    icon: Building2,
    descriptionKey: "adminPanel.organizationsDesc",
    color: "emerald",
  },
  {
    id: "members",
    labelKey: "adminPanel.members",
    icon: Users,
    descriptionKey: "adminPanel.membersDesc",
    color: "violet",
  },
  {
    id: "joinRequests",
    labelKey: "adminPanel.joinRequests",
    icon: UserPlus,
    descriptionKey: "adminPanel.joinRequestsDesc",
    color: "amber",
  },
  {
    id: "meetings",
    labelKey: "adminPanel.meetings",
    icon: Calendar,
    descriptionKey: "adminPanel.meetingsDesc",
    color: "rose",
  },
  {
    id: "policies",
    labelKey: "adminPanel.policies",
    icon: Shield,
    descriptionKey: "adminPanel.policiesDesc",
    color: "cyan",
  },
  {
    id: "reports",
    labelKey: "adminPanel.reports",
    icon: BarChart3,
    descriptionKey: "adminPanel.reportsDesc",
    color: "indigo",
  },
  {
    id: "settings",
    labelKey: "adminPanel.settings",
    icon: Settings,
    descriptionKey: "adminPanel.settingsDesc",
    color: "slate",
  },
  {
    id: "activity",
    labelKey: "adminPanel.activity",
    icon: Activity,
    descriptionKey: "adminPanel.activityDesc",
    color: "orange",
  },
];

const COLOR_MAP = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-100 dark:border-blue-800/50",
    ring: "ring-blue-100 dark:ring-blue-800/30",
    dot: "bg-blue-500",
    gradient: "from-blue-600 to-indigo-600",
    tag: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-100 dark:border-emerald-800/50",
    ring: "ring-emerald-100 dark:ring-emerald-800/30",
    dot: "bg-emerald-500",
    gradient: "from-emerald-600 to-teal-600",
    tag: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-900/20",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-100 dark:border-violet-800/50",
    ring: "ring-violet-100 dark:ring-violet-800/30",
    dot: "bg-violet-500",
    gradient: "from-violet-600 to-purple-600",
    tag: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-800",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-100 dark:border-amber-800/50",
    ring: "ring-amber-100 dark:ring-amber-800/30",
    dot: "bg-amber-500",
    gradient: "from-amber-600 to-orange-600",
    tag: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-900/20",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-100 dark:border-rose-800/50",
    ring: "ring-rose-100 dark:ring-rose-800/30",
    dot: "bg-rose-500",
    gradient: "from-rose-600 to-pink-600",
    tag: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-800",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-100 dark:border-cyan-800/50",
    ring: "ring-cyan-100 dark:ring-cyan-800/30",
    dot: "bg-cyan-500",
    gradient: "from-cyan-600 to-blue-600",
    tag: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-100 dark:border-indigo-800/50",
    ring: "ring-indigo-100 dark:ring-indigo-800/30",
    dot: "bg-indigo-500",
    gradient: "from-indigo-600 to-violet-600",
    tag: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800",
  },
  slate: {
    bg: "bg-slate-50 dark:bg-slate-900/20",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-100 dark:border-slate-800/50",
    ring: "ring-slate-100 dark:ring-slate-800/30",
    dot: "bg-slate-500",
    gradient: "from-slate-600 to-gray-600",
    tag: "bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-800",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-100 dark:border-orange-800/50",
    ring: "ring-orange-100 dark:ring-orange-800/30",
    dot: "bg-orange-500",
    gradient: "from-orange-600 to-red-600",
    tag: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800",
  },
};

const AdminPanel = () => {
  const { t } = useTranslation();
  const [activeModule, setActiveModule] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const listener = (e) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        !e.target.closest("button[aria-label='Toggle sidebar']")
      ) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const activeModuleData = MODULES.find((m) => m.id === activeModule) || MODULES[0];
  const colors = COLOR_MAP[activeModuleData.color];
  const Icon = activeModuleData.icon;

  const stats = [
    { label: t("adminPanel.totalUsers"), value: "—" },
    { label: t("adminPanel.activeOrgs"), value: "—" },
    { label: t("adminPanel.totalMeetings"), value: "—" },
    { label: t("adminPanel.pendingRequests"), value: "—" },
  ];

  const renderModuleContent = () => {
    if (activeModule === "overview") {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("adminPanel.recentActivity")}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t("adminPanel.noActivity")}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${colors.bg} ${colors.ring} ring-1 mb-5`}
          >
            <Icon className={`h-8 w-8 ${colors.text}`} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t(activeModuleData.labelKey)}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {t(activeModuleData.descriptionKey)}
          </p>
          <div
            className={`mt-6 inline-flex items-center gap-2 rounded-full border ${colors.tag} px-4 py-1.5 text-xs font-semibold`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
            {t("adminPanel.comingSoon")}
          </div>
        </div>
      </div>
    );
  };

  const sidebarItems = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {MODULES.map((mod) => {
        const ModIcon = mod.icon;
        const isActive = activeModule === mod.id;
        const modColors = COLOR_MAP[mod.color];
        return (
          <button
            key={mod.id}
            onClick={() => {
              setActiveModule(mod.id);
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left cursor-pointer ${
              isActive
                ? `${modColors.bg} ${modColors.text} shadow-sm`
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <ModIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">{t(mod.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Navbar />

      <div className="flex flex-1 pt-16">
        <aside
          ref={sidebarRef}
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:pt-16 ${
            sidebarOpen ? "translate-x-0 pt-16" : "-translate-x-full pt-16"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-violet-600">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {t("adminPanel.title")}
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {sidebarItems}
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg} ${colors.ring} ring-1`}
                >
                  <Icon className={`h-5 w-5 ${colors.text}`} />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {t(activeModuleData.labelKey)}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t(activeModuleData.descriptionKey)}
                  </p>
                </div>
              </div>
            </div>

            {renderModuleContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
