import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { Github, ArrowUp } from "lucide-react";

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const isLandingPage = location.pathname === "/";

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleNavLink = (href) => {
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!isLandingPage) {
    return (
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: Brand logo & Copyright */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4">
              <Link to="/" className="flex items-center gap-2 group">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 100 100"
                  className="w-6 h-6 transition-transform duration-300 group-hover:scale-105"
                >
                  <defs>
                    <linearGradient
                      id="compactInfinityGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M25,50 C25,35 38,30 50,50 C62,70 75,65 75,50 C75,35 62,30 50,50 C38,70 25,65 25,50 Z"
                    fill="none"
                    stroke="url(#compactInfinityGrad)"
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="25" cy="50" r="6.5" fill="#2563eb" />
                  <circle cx="75" cy="50" r="6.5" fill="#7c3aed" />
                </svg>
                <span className="font-bold text-sm text-gray-900 dark:text-gray-100 tracking-tight">
                  MeetOn
                  <span className="text-blue-600 dark:text-blue-400">
                    Memory
                  </span>
                </span>
              </Link>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-600">
                |
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                &copy; {currentYear} MeetOnMemory.{" "}
                {t("footer.allRightsReserved")}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full">
                v1.0.0
              </span>
            </div>

            {/* Right: Links & Back to Top */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Link
                to="/privacy"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                {t("footer.privacy")}
              </Link>
              <Link
                to="/terms"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                {t("footer.terms")}
              </Link>
              <Link
                to="/security"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                {t("footer.security", "Security")}
              </Link>
              <Link
                to="/cookie-policy"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                Cookies
              </Link>
              <Link
                to="/help-center"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                {t("footer.helpCenter", "Help Center")}
              </Link>
              <Link
                to="/careers"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                {t("footer.careers", "Careers")}
              </Link>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <Link
                to="/contact"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                {t("footer.contact", "Contact")}
              </Link>
              <Link
                to="/status"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                {t("footer.status", "Status")}
              </Link>
              <a
                href="https://github.com/imuniqueshiv/MeetOnMemory"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                <Github className="w-3.5 h-3.5" />
                GitHub
              </a>
              <button
                onClick={scrollToTop}
                className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 group"
                aria-label="Scroll back to top"
              >
                <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                {t("footer.backToTop")}
              </button>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pt-16 pb-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
          {/* Column 1: Project Info */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center">
                {/* Clean Native Option A Infinity Symbol tuned for Footer Sizing */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 100 100"
                  className="w-10 h-10 transition-transform duration-300"
                >
                  <defs>
                    <linearGradient
                      id="footerInfinityGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M25,50 C25,35 38,30 50,50 C62,70 75,65 75,50 C75,35 62,30 50,50 C38,70 25,65 25,50 Z"
                    fill="none"
                    stroke="url(#footerInfinityGrad)"
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="25" cy="50" r="6.5" fill="#2563eb" />
                  <circle cx="75" cy="50" r="6.5" fill="#7c3aed" />
                </svg>
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-gray-100 tracking-tight">
                MeetOn
                <span className="text-blue-600 dark:text-blue-400">Memory</span>
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm font-medium leading-snug">
              {t("hero.badge")}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm leading-relaxed">
              {t("footer.description")}
            </p>
            {/* GitHub social link */}
            <a
              href="https://github.com/imuniqueshiv/MeetOnMemory"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MeetOnMemory GitHub repository"
              className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200 mt-1 group w-fit"
            >
              <Github className="w-4 h-4 group-hover:scale-110 transition-transform" />
              {t("footer.meetOnMemoryTeam")}
            </a>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-5">
              {t("footer.product")}
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link
                  to="/"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block"
                >
                  Home
                </Link>
              </li>
              <li>
                <button
                  onClick={() => handleNavLink("#features")}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block text-left"
                  aria-label="Scroll to Features section"
                >
                  {t("navbar.features")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavLink("#how-it-works")}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block text-left"
                  aria-label="Scroll to How It Works section"
                >
                  {t("navbar.howItWorks")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavLink("#about")}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block text-left"
                  aria-label="Scroll to About section"
                >
                  {t("navbar.about")}
                </button>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block"
                >
                  {t("navbar.dashboard")}
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block"
                >
                  {t("navbar.login")}
                </Link>
              </li>
              <li>
                <Link
                  to="/status"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block"
                >
                  {t("footer.status", "System Status")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-5">
              {t("footer.company")}
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link
                  to="/help-center"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block font-medium"
                >
                  {t("footer.helpCenter", "Help Center")}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block font-medium"
                >
                  Contact Support
                </Link>
              </li>
              <li>
                <Link
                  to="/careers"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block font-medium"
                >
                  {t("footer.careers", "Careers")}
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/imuniqueshiv/MeetOnMemory"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="MeetOnMemory GitHub repository (opens in new tab)"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/imuniqueshiv/MeetOnMemory/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Report issues on GitHub (opens in new tab)"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block"
                >
                  Report Issues
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/imuniqueshiv/MeetOnMemory/blob/main/CONTRIBUTING.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Contributing guide (opens in new tab)"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block"
                >
                  Contributing
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/imuniqueshiv/MeetOnMemory/blob/main/CODE_OF_CONDUCT.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Code of Conduct (opens in new tab)"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 inline-block"
                >
                  Code of Conduct
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Built with */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-5">
              {t("footer.getInTouch")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {[
                "React",
                "Node.js",
                "Express",
                "MongoDB",
                "Google Gemini",
                "Pinecone",
              ].map((tech) => (
                <li
                  key={tech}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-linear-to-br from-blue-600 to-violet-600 flex-shrink-0"
                    aria-hidden="true"
                  />
                  {tech}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              &copy; {currentYear} MeetOnMemory. {t("footer.allRightsReserved")}
            </p>
            <span className="hidden sm:inline text-gray-300 dark:text-gray-700">
              |
            </span>
            <div className="flex items-center gap-3 text-xs font-medium text-gray-400 dark:text-gray-500">
              <Link
                to="/privacy"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t("footer.privacy")}
              </Link>
              <span>•</span>
              <Link
                to="/terms"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t("footer.terms")}
              </Link>
              <span>•</span>
              <Link
                to="/security"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t("footer.security", "Security")}
              </Link>
              <span>•</span>
              <Link
                to="/cookie-policy"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Cookies
              </Link>
              <span>•</span>
              <Link
                to="/help-center"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t("footer.helpCenter", "Help Center")}
              </Link>
              <span>•</span>
              <Link
                to="/careers"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t("footer.careers", "Careers")}
              </Link>
              <span>•</span>
              <Link
                to="/contact"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t("footer.contact", "Contact")}
              </Link>
              <span>•</span>
              <Link
                to="/status"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t("footer.status", "Status")}
              </Link>
            </div>
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            {t("footer.madeWith")} ❤️ {t("footer.by")}{" "}
            {t("footer.meetOnMemoryTeam")}.
          </p>
          {/* Back to top */}
          <button
            onClick={scrollToTop}
            aria-label="Scroll back to top"
            className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 group focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md px-1"
          >
            <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform duration-200" />
            {t("footer.backToTop")}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
