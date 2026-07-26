import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  Cookie,
  Shield,
  Search,
  ChevronRight,
  ChevronDown,
  Clock,
  Lock,
  Settings,
  Info,
  Check,
  HelpCircle,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Fingerprint,
  Sliders,
  Globe,
  Database
} from "lucide-react";

const CookiePolicy = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("introduction");
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Dynamic state for interactive Cookie Console
  const [preferences, setPreferences] = useState({
    essential: true,
    functional: true,
    analytics: false,
    targeting: false,
    aiContext: false,
  });
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [clearedLogs, setClearedLogs] = useState(false);

  // References for scrollspy/scroll tracking
  const sectionRefs = useMemo(
    () => ({
      introduction: React.createRef(),
      whatAreCookies: React.createRef(),
      howWeUseCookies: React.createRef(),
      typesOfCookies: React.createRef(),
      cookieInventory: React.createRef(),
      aiProcessingCookies: React.createRef(),
      preferenceCenter: React.createRef(),
      browserSettings: React.createRef(),
      legalCompliance: React.createRef(),
      policyChanges: React.createRef(),
      contactUs: React.createRef(),
    }),
    [],
  );

  const sections = useMemo(
    () => [
      {
        id: "introduction",
        title: "1. Introduction & Scope",
        icon: Globe,
        content: `Welcome to the MeetOnMemory Cookie Policy. This policy explains how MeetOnMemory ("we", "us", or "our") uses cookies, web beacons, local storage, and similar tracking technologies when you visit our web application, access our transcription dashboard, or interact with any associated services (collectively, the "Service").
        
        We believe in absolute transparency regarding how we handle your data. In line with modern privacy standards (such as GDPR, CCPA, and the ePrivacy Directive), this policy outlines what cookies are, why we use them, and the granular controls you possess to manage your browser storage configuration at any time.
        
        Please read this policy alongside our primary Privacy Policy and Terms of Service to understand our comprehensive approach to data protection, Pinecone vector workspace isolation, and zero-retention Google Gemini API data processing guidelines.`,
      },
      {
        id: "whatAreCookies",
        title: "2. What Are Cookies?",
        icon: Cookie,
        content: `Cookies are small text files containing a string of alphanumeric characters that are downloaded to your computer or mobile device when you visit a website or web application. They allow the website to recognize your device, maintain security, remember preferences, and optimize load speeds.
        
        Depending on their origin and duration, cookies can be categorized as follows:
        
        - First-Party Cookies: Set directly by MeetOnMemory. These are primarily used to keep you securely signed in and to preserve user settings like dark mode and language preferences.
        - Third-Party Cookies: Placed by domain partners (such as analytics providers or cloud infrastructure tools) to track usage metrics or run external assets.
        - Session Cookies: Temporary cookies that expire and are automatically erased when you close your web browser.
        - Persistent Cookies: Remain on your device's storage for a specified period or until you manually delete them. These help us remember you when you return.`,
      },
      {
        id: "howWeUseCookies",
        title: "3. How We Use Cookies",
        icon: Sliders,
        content: `MeetOnMemory utilizes cookies and local storage parameters to ensure our AI meeting workspace is fast, secure, and intuitive. We do not sell cookie data, nor do we use tracking cookies for intrusive advertising campaigns.
        
        Our cookies serve the following core categories of operational functionality:
        
        A. Authentication & Security:
        Verifying your login sessions, preventing cross-site request forgery (CSRF) attacks, and identifying active organization memberships.
        
        B. User Experience & Customization:
        Remembering your interface preferences, such as light vs. dark mode, active dashboard layouts, language filters (English/Hindi), and sidebar visibility states.
        
        C. Performance & Scale:
        Distributing incoming API request traffic across our cloud server clusters to prevent service disruption and slow loading times during high-volume transcription queues.
        
        D. Usage Analytics:
        Aggregating anonymous, de-identified statistics on page interaction speeds, feature popularity, and browser compatibility to refine our platform.`,
      },
      {
        id: "typesOfCookies",
        title: "4. Categories of Tracking Technologies",
        icon: Settings,
        content: `We classify the tracking technologies used in our system into four logical groups. You can restrict or opt-out of functional, analytical, and targeting configurations via the interactive Preference Console on this page:
        
        1. Strictly Necessary Cookies (Always Active):
        These cookies are essential for you to browse our site and use its secure features. Without them, features like user authentication, multi-tenant workspace isolation, and session maintenance will fail.
        
        2. Functional Cookies:
        These allow our web application to remember choices you make (such as your sidebar navigation state, dark mode preferences, or customized meeting dashboard filters) to deliver a highly personalized experience.
        
        3. Performance & Analytics Cookies:
        These collect information about how visitors use MeetOnMemory—for example, which pages are visited most often and if any server errors occur. The data collected is aggregated and anonymous.
        
        4. Targeted Contextual Cookies:
        Used to manage customized product notifications, feature tour guides, or feedback popups. We do not serve third-party behavioral advertisements on MeetOnMemory.`,
      },
      {
        id: "cookieInventory",
        title: "5. Detailed Cookie Inventory",
        icon: Database,
        content: `The following is an audited list of the specific cookies and browser local storage variables utilized within the MeetOnMemory platform:
        
        - token (Local Storage / Cookie):
          - Purpose: Stores your encrypted JSON Web Token (JWT) session token to verify credentials for secure API calls.
          - Expiration: 7 days or upon logout.
          - Type: Essential First-Party.
          
        - mom_theme (Local Storage):
          - Purpose: Retains your visual theme selection (light, dark, or system default) to prevent screen flickering on page load.
          - Expiration: Persistent.
          - Type: Functional First-Party.
          
        - mom_lang (Local Storage):
          - Purpose: Saves your active localization language (e.g., 'en' for English or 'hi' for Hindi).
          - Expiration: Persistent.
          - Type: Functional First-Party.
          
        - _ga / _gid (Cookie):
          - Purpose: Set by Google Analytics to distinguish users and compile aggregated, non-personally identifiable site usage statistics.
          - Expiration: 2 years / 24 hours.
          - Type: Analytics Third-Party.
          
        - mom_sidebar_collapsed (Local Storage):
          - Purpose: Stores the visual state of the workspace navigation panel.
          - Expiration: Persistent.
          - Type: Functional First-Party.`,
      },
      {
        id: "aiProcessingCookies",
        title: "6. AI Processing & Storage Rules",
        icon: Fingerprint,
        content: `Because MeetOnMemory processes highly confidential meeting audio, video recordings, and transcripts, we maintain strict isolation standards regarding browser storage and AI services:
        
        A. Zero-Retention Gemini API Calls:
        When you submit transcripts or request meeting summaries via Google Gemini, no browser cookies are forwarded to Google. All communication with AI endpoints is managed securely via our backend servers using secure, server-side API keys.
        
        B. Pinecone Vector Isolation:
        Your organization's vector search embeddings are indexed using logical Organization ID keys on our cloud database. Browser cookies are only used to authenticate your authorization to query these indexes. No search history or query vectors are stored in persistent browser cookies.
        
        C. Local Media Uploads:
        Audio and video files chosen for transcription are streamed directly to our secure storage buckets. We do not cache or store temporary media files in browser local storage or IndexedDB.`,
      },
      {
        id: "preferenceCenter",
        title: "7. Cookie Settings Console",
        icon: Sliders,
        content: `Use this interactive preference center to control how MeetOnMemory handles cookies and local storage on your current browser. Toggling off analytical, functional, or AI-context cookies will instantly adjust our application parameters.`,
      },
      {
        id: "browserSettings",
        title: "8. Browser Controls & Deletion",
        icon: Trash2,
        content: `In addition to our Preference Settings Console, you can manage, block, or delete cookies directly through your web browser's configuration panel:
        
        - Google Chrome: Go to Settings > Privacy and Security > Cookies and other site data.
        - Mozilla Firefox: Go to Settings > Privacy & Security > Cookies and Site Data.
        - Apple Safari: Go to Preferences > Privacy > Block all cookies.
        - Microsoft Edge: Go to Settings > Cookies and site permissions > Manage and delete cookies and site data.
        
        Please note that if you choose to completely block all cookies in your browser settings, key features of the MeetOnMemory application (such as keeping you logged in) will cease to function correctly.`,
      },
      {
        id: "legalCompliance",
        title: "9. Global Regulatory Compliance",
        icon: Shield,
        content: `Our cookie practices are aligned with international privacy frameworks:
        
        A. GDPR & ePrivacy Directive (EEA/UK):
        We require explicit, opt-in consent for all non-essential cookies (such as analytics and functional trackers) before they are set on your device. You have the right to withdraw this consent at any time.
        
        B. CCPA & CPRA (California):
        Under the California Consumer Privacy Act, users have the right to opt-out of the "sale or sharing" of personal data. MeetOnMemory does not sell your information. Toggling off analytical cookies ensures no sharing of tracking indicators.
        
        C. Organization Security Polices:
        Enterprise workspaces can enforce global cookie policies that disable third-party analytics across all organization member accounts.`,
      },
      {
        id: "policyChanges",
        title: "10. Cookie Mandate Updates",
        icon: RefreshCw,
        content: `We may revise this Cookie Policy periodically to reflect changes in our tech stack, cloud infrastructure, or legal requirements.
        
        Whenever updates are implemented, we will revise the "Last Updated" date at the top of this page. If the changes are material, we will display a notification banner within your dashboard or send an email update to registered workspace administrators. We encourage you to review this page regularly to stay informed.`,
      },
      {
        id: "contactUs",
        title: "11. Cookie Support & Queries",
        icon: Info,
        content: `If you have questions regarding our use of cookies, local storage variables, or our security protocols, please reach out to our privacy compliance team:
        
        - Email: privacy@meetonmemory.com
        - Security Desk: security@meetonmemory.com
        - Address: MeetOnMemory Legal Dept, 548 Market St, Suite 4839, San Francisco, CA 94104
        
        We are committed to responding to all privacy inquiries within 30 days.`,
      },
    ],
    [],
  );

  const faqs = [
    {
      q: "Why does the platform require Local Storage?",
      a: "Local storage is utilized to maintain UI settings (like dark mode and active language selection) without requiring round-trips to the database on every page load. This keeps your dashboard instantly responsive.",
    },
    {
      q: "Does turning off Analytics affect transcription performance?",
      a: "Not at all. Disabling Analytics cookies only stops us from receiving anonymous interaction logs (like button clicks). Your transcription speed, AI summaries, and meeting search capabilities remain completely unaffected.",
    },
    {
      q: "How can I check all cookies currently stored by MeetOnMemory?",
      a: "You can inspect them by opening your browser Developer Tools (F12 or right-click > Inspect), navigating to the 'Application' or 'Storage' tab, and selecting 'Cookies' or 'Local Storage'.",
    },
    {
      q: "Are session transcripts stored in my browser cookie history?",
      a: "Absolutely not. Your transcript text, audio files, and summary PDFs are kept securely on our backend servers and encrypted MongoDB storage. No conversation data is ever stored in browser cookies.",
    },
  ];

  // Scrollspy to update active table of contents link during scrolling
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;

      for (let i = 0; i < sections.length; i++) {
        const secId = sections[i].id;
        const element = sectionRefs[secId]?.current;
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(secId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections, sectionRefs]);

  // Smooth scroll offset click handler
  const scrollToSection = (id) => {
    const element = sectionRefs[id].current;
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: "smooth",
      });
      setActiveSection(id);
    }
  };

  // Filter sections dynamically based on user search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase();
    return sections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(query) ||
        sec.content.toLowerCase().includes(query)
    );
  }, [searchQuery, sections]);

  // Handle Cookie Preferences Save Action
  const handleSavePreferences = () => {
    // Save to local storage for persistence simulator
    localStorage.setItem("mom_cookie_preferences", JSON.stringify(preferences));
    setShowSaveToast(true);
    setTimeout(() => {
      setShowSaveToast(false);
    }, 4000);
  };

  // Handle Clear Local Storage Simulator
  const handleClearStorage = () => {
    setPreferences({
      essential: true,
      functional: false,
      analytics: false,
      targeting: false,
      aiContext: false,
    });
    setClearedLogs(true);
    setTimeout(() => {
      setClearedLogs(false);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 flex flex-col">
      <Navbar />

      {/* Header Banner */}
      <header className="relative overflow-hidden bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-gray-100 dark:border-slate-800 pt-28 pb-16">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-blue-300 dark:bg-blue-900/30 blur-3xl animate-blob" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-indigo-300 dark:bg-indigo-900/20 blur-3xl animate-blob animation-delay-2000" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 dark:bg-blue-950/50 border border-blue-200/50 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4 animate-fade-in">
            <Cookie className="w-3.5 h-3.5" /> Privacy & Caches
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
            Cookie Policy
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-gray-500 dark:text-slate-400">
            Learn how we configure cookies, local browser storage, and AI processing parameters to protect your organizational workspace.
          </p>

          {/* Search bar inside the policy */}
          <div className="mt-8 max-w-md mx-auto relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search cookie policy, settings, data types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-6 text-xs text-gray-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Last Updated: July 17, 2026
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> Version: 1.1
            </span>
          </div>
        </div>
      </header>

      {/* Content Layout Grid */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Navigation TOC */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-28 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs max-h-[calc(100vh-140px)] overflow-y-auto">
              <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5 px-2">
                <Sliders className="w-4 h-4 text-blue-500" /> Cookie Outline
              </h3>
              <nav className="space-y-1.5">
                {sections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-left transition duration-200 ${
                        isActive
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/30"
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`} />
                      <span className="truncate">{sec.title.split(". ")[1]}</span>
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto text-blue-600 dark:text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              </nav>

              <hr className="my-5 border-gray-100 dark:border-slate-700/60" />

              {/* Sidebar Quick Card */}
              <div className="bg-linear-to-tr from-blue-600 to-indigo-700 text-white rounded-xl p-4.5 shadow-xs relative overflow-hidden">
                <div className="absolute right-0 bottom-0 translate-y-6 translate-x-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Need assistance?
                </h4>
                <p className="text-[11px] text-blue-100 mt-2 leading-relaxed">
                  Have questions about GDPR cookie consents or browser data deletes? Contact our support desk.
                </p>
                <Link
                  to="/contact"
                  className="inline-block mt-3.5 bg-white text-blue-700 font-semibold text-xs px-3.5 py-1.5 rounded-md hover:bg-blue-50 transition"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Column: Clauses and Preferences */}
          <div className="lg:col-span-8 space-y-12">

            {/* Filter Active Alert */}
            {searchQuery && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Search Filter Active</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Showing segments matching "{searchQuery}". Clear search bar to view entire document.
                  </p>
                </div>
              </div>
            )}

            {/* Main Document Text */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-10">
              {filteredSections.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">No sections match your query</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                    Try searching for general keywords like 'JWT', 'Gemini', 'delete', or 'GDPR'.
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                filteredSections.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <article
                      key={sec.id}
                      ref={sectionRefs[sec.id]}
                      className="scroll-mt-24 border-b border-gray-100 last:border-0 dark:border-slate-700/60 pb-8 last:pb-0"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                          <Icon className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          {sec.title}
                        </h2>
                      </div>
                      
                      {/* Render custom interactive console if this is the preferenceCenter section */}
                      {sec.id === "preferenceCenter" ? (
                        <div className="space-y-6 mt-6">
                          <p className="text-sm text-gray-500 dark:text-slate-400">
                            Configure your preferences below. Essential cookies are required to maintain your platform session.
                          </p>

                          <div className="space-y-4">
                            {/* Option 1: Essential */}
                            <div className="flex items-start justify-between p-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl">
                              <div className="max-w-[80%]">
                                <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                                  Strictly Essential Cookies
                                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full">
                                    Required
                                  </span>
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                  Enables JWT secure login, cross-site request validation, and prevents horizontal team data leakage.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={preferences.essential}
                                disabled
                                className="h-4.5 w-4.5 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 opacity-60 cursor-not-allowed mt-1"
                              />
                            </div>

                            {/* Option 2: Functional */}
                            <div className="flex items-start justify-between p-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl">
                              <div className="max-w-[80%]">
                                <h4 className="font-bold text-sm text-gray-800 dark:text-white">
                                  Functional Settings
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                  Caches interface custom options such as Dark Theme configurations and English/Hindi translations.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={preferences.functional}
                                onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                                className="h-4.5 w-4.5 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1"
                              />
                            </div>

                            {/* Option 3: Analytics */}
                            <div className="flex items-start justify-between p-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl">
                              <div className="max-w-[80%]">
                                <h4 className="font-bold text-sm text-gray-800 dark:text-white">
                                  Performance & Analytics
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                  Permits anonymous tracking indicators to analyze API response lags, upload throughputs, and page hits.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={preferences.analytics}
                                onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                                className="h-4.5 w-4.5 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1"
                              />
                            </div>

                            {/* Option 4: Targeting */}
                            <div className="flex items-start justify-between p-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl">
                              <div className="max-w-[80%]">
                                <h4 className="font-bold text-sm text-gray-800 dark:text-white">
                                  Contextual Product Notifications
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                  Enables us to run interactive tutorial sequences and announce release notes within your workspace dashboard.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={preferences.targeting}
                                onChange={(e) => setPreferences({ ...preferences, targeting: e.target.checked })}
                                className="h-4.5 w-4.5 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                            <button
                              onClick={handleClearStorage}
                              className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                            >
                              Reset to Essential Only
                            </button>
                            <button
                              onClick={handleSavePreferences}
                              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
                            >
                              <Check className="w-4 h-4" /> Save Preferences
                            </button>
                          </div>

                          {showSaveToast && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-400 animate-fade-in">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                              <span>Browser cookie permissions saved! The current session settings have been updated.</span>
                            </div>
                          )}

                          {clearedLogs && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-400 animate-fade-in">
                              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                              <span>Cookie settings reset to minimal essential settings. Non-essential storage cleared.</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm sm:text-base text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-line space-y-4">
                          {sec.content}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>

            {/* Cookie FAQs Accordion */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Cookie & Storage FAQs
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Quick answers regarding data security, transcripts, and storage boundaries.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, idx) => {
                  const isOpen = expandedFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-gray-100 dark:border-slate-700/60 rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedFaq(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-700/10 hover:bg-gray-50 dark:hover:bg-slate-700/30 text-left transition duration-150"
                      >
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                          {faq.q}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ml-2 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700/60 text-xs sm:text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* Redirect Footer Bar */}
      <div className="bg-gray-100 dark:bg-slate-900 border-t border-gray-200/80 dark:border-slate-800/80 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
            Have questions about standard contract clauses or DPA agreements?
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-semibold">
            <Link
              to="/privacy"
              className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
            >
              Read Full Privacy Policy
            </Link>
            <Link
              to="/"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
