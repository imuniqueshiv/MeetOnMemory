import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Brain, Search, BarChart3, Users, ArrowRight } from "lucide-react";


const useIntersectionFade = (threshold = 0.15) => {
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
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return ref;
};

const About = () => {
  const navigate = useNavigate();
  const headingRef = useIntersectionFade();
  const { t } = useTranslation();

  const features = [
    {
      icon: Brain,
      title: t("about.aiMeetingIntelligence"),
      description: t("about.aiMeetingIntelligenceDesc"),
      gradient: "from-blue-600 to-violet-600",
    },
    {
      icon: Search,
      title: t("about.semanticSearch"),
      description: t("about.semanticSearchDesc"),
      gradient: "from-pink-500 to-rose-500",
    },
    {
      icon: BarChart3,
      title: t("about.smartReports"),
      description: t("about.smartReportsDesc"),
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: Users,
      title: t("about.teamCollaboration"),
      description: t("about.teamCollaborationDesc"),
      gradient: "from-orange-500 to-amber-500",
    },
  ];

  return (
    <section
      id="about"
      className="py-24 bg-linear-to-b from-white to-slate-50 dark:from-gray-900 dark:to-gray-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Header */}
        <div
          ref={headingRef}
          className="fade-in-up text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
            {t("about.badge")}
          </span>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-5 leading-tight">
            {t("about.heading1_prefix")}
            <span className="bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              MeetOnMemory
            </span>
            {t("about.heading1_suffix")}
          </h2>

          <p className="mt-5 text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
            {t("about.description")}
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const stagger = `stagger-${Math.min(index + 1, 6)}`;
            return (
              <AboutCard
                key={index}
                Icon={Icon}
                feature={feature}
                stagger={stagger}
              />
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <button
            id="about-cta-btn"
            onClick={() => navigate("/login?mode=signup")}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-linear-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-100 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Join MeetOnMemory today"
          >
            {t("about.joinToday")}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
};

const AboutCard = (props) => {
  const { Icon, feature, stagger } = props;
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

  return (
    <div
      ref={ref}
      className={`fade-in-up ${stagger} group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-7 shadow-sm h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 dark:hover:border-blue-600`}
    >
      <div
        className={`w-12 h-12 rounded-xl bg-linear-to-br ${feature.gradient} flex items-center justify-center text-white mx-auto mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
        {feature.title}
      </h3>

      <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-center text-sm">
        {feature.description}
      </p>
    </div>
  );
};

export default About;
