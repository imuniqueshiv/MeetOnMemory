import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  FaMicrophone,
  FaChartBar,
  FaFolderOpen,
  FaDatabase,
  FaRobot,
  FaSearch,
} from "react-icons/fa";
import { FaArrowRight } from "react-icons/fa6";


const FeatureCard = ({ icon, title, description, iconBg, index }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const staggerClass = `stagger-${Math.min(index + 1, 6)}`;

  return (
    <div
      ref={ref}
      className={`fade-in-up ${staggerClass} group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-600 relative overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-2`}
      style={{
        boxShadow: "var(--shadow-card)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
      }}
    >
      {/* Icon */}
      <div
        className={`w-13 h-13 rounded-xl ${iconBg} flex items-center justify-center text-white text-xl mb-5 group-hover:scale-110 transition-transform duration-300 shadow-md`}
        style={{ width: "3.25rem", height: "3.25rem" }}
      >
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 leading-snug">
        {title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
        {description}
      </p>

      {/* Hover glow overlay */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-linear-to-br from-blue-500/[0.03] to-purple-500/[0.06]" />
    </div>
  );
};

const Features = () => {
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const { t } = useTranslation();

  const featuresData = [
    {
      id: 1,
      icon: <FaRobot />,
      title: t("features.aiMeetingSummaries"),
      description: t("features.aiMeetingSummariesDesc"),
      gradient: "from-indigo-500 to-purple-500",
      iconBg: "bg-linear-to-br from-indigo-500 to-purple-500",
    },
    {
      id: 2,
      icon: <FaSearch />,
      title: t("features.smartSearch"),
      description: t("features.smartSearchDesc"),
      gradient: "from-pink-500 to-rose-400",
      iconBg: "bg-linear-to-br from-pink-500 to-rose-400",
    },
    {
      id: 3,
      icon: <FaMicrophone />,
      title: t("features.meetingRecording"),
      description: t("features.meetingRecordingDesc"),
      gradient: "from-blue-500 to-cyan-400",
      iconBg: "bg-linear-to-br from-blue-500 to-cyan-400",
    },
    {
      id: 4,
      icon: <FaChartBar />,
      title: t("features.reportsAnalytics"),
      description: t("features.reportsAnalyticsDesc"),
      gradient: "from-purple-500 to-pink-400",
      iconBg: "bg-linear-to-br from-purple-500 to-pink-400",
    },
    {
      id: 5,
      icon: <FaFolderOpen />,
      title: t("features.policyManagement"),
      description: t("features.policyManagementDesc"),
      gradient: "from-green-500 to-emerald-400",
      iconBg: "bg-linear-to-br from-green-500 to-emerald-400",
    },
    {
      id: 6,
      icon: <FaDatabase />,
      title: t("features.institutionalMemory"),
      description: t("features.institutionalMemoryDesc"),
      gradient: "from-orange-500 to-amber-400",
      iconBg: "bg-linear-to-br from-orange-500 to-amber-400",
    },
  ];

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Section Heading */}
        <div
          ref={headingRef}
          className="fade-in-up text-center mb-16 max-w-2xl mx-auto"
        >
          <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 mb-5">
            {t("features.badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {t("features.heading1")}{" "}
            <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t("features.heading2")}
            </span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-4 text-base leading-relaxed">
            {t("features.subtitle")}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresData.map((feature, index) => (
            <FeatureCard key={feature.id} {...feature} index={index} />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <button
            id="features-cta-btn"
            onClick={() => navigate("/login?mode=signup")}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-linear-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-100 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Start using MeetOnMemory for free"
          >
            {t("features.startForFree")}
            <FaArrowRight className="group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Features;

