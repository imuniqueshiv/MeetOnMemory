import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import AppContent from "../context/AppContent";
import {
  FileText,
  Upload,
  BarChart3,
  Brain,
  Search,
  ArrowRight,
  Sparkles,
  Shield,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import TopContributorsWidget from "../components/organization/TopContributorsWidget";
import OrganizationLogo from "../components/organization/OrganizationLogo.jsx";
import OrganizationBanner from "../components/organization/OrganizationBanner.jsx";

/* ─── Role Badge ──────────────────────────────────────────────────────────── */
const ROLE_STYLES = {
  admin: "bg-violet-50 text-violet-700 border-violet-200",
  manager: "bg-blue-50 text-blue-700 border-blue-200",
  member: "bg-sky-50 text-sky-700 border-sky-200",
  guest: "bg-slate-100 text-slate-600 border-slate-200",
};

const ROUTE_MAP = {
  "upload-meeting": "/upload-meeting",
  "create-meeting": "/create-meeting",
  summaries: "/summaries",
  policies: "/policies",
  reports: "/reports",
};

/* ─── Dashboard ───────────────────────────────────────────────────────────── */
const Dashboard = () => {
  const { t } = useTranslation();
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();

  const organizationName =
    userData?.organization?.name?.toUpperCase() || "ORGANIZATION";
  const organizationLogoUrl =
    userData?.organization?.logoUrl || userData?.organization?.logo || "";
  const organizationBannerUrl = userData?.organization?.bannerUrl || "";

  const rawRole = userData?.role || "member";
  const displayRole =
    rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();
  const roleStyle = ROLE_STYLES[rawRole.toLowerCase()] || ROLE_STYLES.member;

  const isAdmin =
    rawRole.toLowerCase() === "admin" || rawRole.toLowerCase() === "owner";

  const FEATURE_CARDS = [
    {
      id: "upload-meeting",
      icon: Upload,
      title: t("dashboard.uploadMeetings"),
      description: t("dashboard.uploadMeetingsDesc"),
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      tag: t("dashboard.transcription"),
      tagColor: "bg-blue-50 text-blue-700 border-blue-100",
      accentRing: "group-hover:ring-blue-100",
      adminOnly: true,
    },
    {
      id: "create-meeting",
      icon: FileText,
      title: t("dashboard.meetingEventHub"),
      description: t("dashboard.meetingEventHubDesc"),
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      tag: t("dashboard.scheduling"),
      tagColor: "bg-emerald-50 text-emerald-700 border-emerald-100",
      accentRing: "group-hover:ring-emerald-100",
      adminOnly: true,
    },
    {
      id: "summaries",
      icon: Brain,
      title: t("dashboard.aiSummarization"),
      description: t("dashboard.aiSummarizationDesc"),
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      tag: t("dashboard.aiPowered"),
      tagColor: "bg-violet-50 text-violet-700 border-violet-100",
      accentRing: "group-hover:ring-violet-100",
    },
    {
      id: "policies",
      icon: Shield,
      title: t("dashboard.policiesRepository"),
      description: t("dashboard.policiesRepositoryDesc"),
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      tag: t("dashboard.complianceTag"),
      tagColor: "bg-amber-50 text-amber-700 border-amber-100",
      accentRing: "group-hover:ring-amber-100",
    },
    {
      id: "reports",
      icon: BarChart3,
      title: t("dashboard.reportsAnalytics"),
      description: t("dashboard.reportsAnalyticsDesc"),
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      tag: t("dashboard.analytics"),
      tagColor: "bg-indigo-50 text-indigo-700 border-indigo-100",
      accentRing: "group-hover:ring-indigo-100",
    },
  ];

  const visibleCards = FEATURE_CARDS.filter(
    (card) => !card.adminOnly || isAdmin,
  );

  const handleAISearch = () => navigate("/ai-search");
  const handleCardClick = (id) => navigate(ROUTE_MAP[id]);

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 sm:pb-16">
        {/* ── Hero + AI Search — unified panel ── */}
        <section
          aria-label="Dashboard hero"
          className="relative mb-6 sm:mb-8 fade-in-up stagger-1"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-12 h-56 w-56 rounded-full bg-blue-200/30 dark:bg-blue-900/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-violet-200/25 dark:bg-violet-900/20 blur-3xl"
          />

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div
              aria-hidden="true"
              className="h-1 bg-linear-to-r from-blue-600 via-violet-600 to-indigo-600"
            />

            {/* Branded org header — banner background with readable overlay */}
            <div className="relative">
              <OrganizationBanner
                src={organizationBannerUrl}
                name={userData?.organization?.name || organizationName}
                heightClass="h-full"
                className="absolute inset-0"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-r from-slate-900/75 via-slate-900/55 to-slate-900/35 dark:from-gray-950/85 dark:via-gray-900/65 dark:to-gray-900/45"
              />
              <div className="relative px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <OrganizationLogo
                      src={organizationLogoUrl}
                      name={userData?.organization?.name || organizationName}
                      size="lg"
                    />

                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                          {organizationName}
                        </h1>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${roleStyle}`}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
                            aria-hidden="true"
                          />
                          {displayRole}
                        </span>
                      </div>
                      <p className="max-w-xl text-sm leading-relaxed text-slate-200 sm:text-base">
                        {t("dashboard.welcomeBack")}{" "}
                        <span className="font-semibold text-white">
                          {userData?.name || t("dashboard.there")}
                        </span>
                        {t("dashboard.everythingHere")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Smart Search — integrated CTA */}
            <div className="px-5 pt-7 pb-7 sm:px-8 sm:pt-8 sm:pb-9 lg:px-10">
              <div
                className="rounded-xl border border-slate-200/80 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-700/50 p-5 sm:p-6"
                role="region"
                aria-label="AI Smart Search"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-slate-200/80 dark:ring-gray-600"
                    >
                      <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-gray-100 sm:text-lg">
                          {t("dashboard.smartSearch")}
                        </h2>
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          {t("dashboard.aiPowered")}
                        </span>
                      </div>
                      <p className="max-w-lg text-sm leading-relaxed text-slate-500 dark:text-gray-400">
                        {t("dashboard.searchDescription")}
                      </p>
                    </div>
                  </div>

                  <button
                    id="dashboard-ai-search-btn"
                    type="button"
                    onClick={handleAISearch}
                    aria-label="Open AI Smart Search"
                    className="group/btn inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-blue-600/25 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:w-auto"
                  >
                    {t("dashboard.openAiSearch")}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature Cards ── */}
        <section aria-label="Dashboard features">
          <header className="mb-4 sm:mb-5 fade-in-up stagger-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-500">
              {t("dashboard.features")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-gray-100 sm:text-2xl">
              {t("dashboard.everythingInOnePlace")}
            </h2>
          </header>

          <div
            data-testid="feature-cards-grid"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visibleCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Navigate to ${card.title}`}
                  onClick={() => handleCardClick(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(card.id);
                    }
                  }}
                  className={`dash-card group relative flex cursor-pointer flex-col rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:border-slate-300/80 dark:hover:border-gray-600 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:p-5 ${card.accentRing}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg} transition-transform duration-200 group-hover:scale-105`}
                    >
                      <Icon
                        className={`h-5 w-5 ${card.iconColor}`}
                        aria-hidden="true"
                      />
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${card.tagColor}`}
                    >
                      {card.tag}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col">
                    <h3 className="mb-1.5 text-base font-semibold leading-snug text-slate-900 dark:text-gray-100">
                      {card.title}
                    </h3>
                    <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500 dark:text-gray-400">
                      {card.description}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 dark:border-gray-700 pt-3 text-xs font-semibold text-slate-400 dark:text-gray-500 transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    <span>{t("dashboard.open")}</span>
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Gamification ── */}
        <section
          aria-label="Organization Engagement"
          className="mt-6 sm:mt-8 fade-in-up stagger-3"
        >
          <TopContributorsWidget
            organizationId={
              userData?.organization?._id || userData?.organization
            }
          />
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
