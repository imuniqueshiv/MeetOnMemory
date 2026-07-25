import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  HelpCircle,
  Search,
  BookOpen,
  Shield,
  Clock,
  Layers,
  ArrowRight,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Settings,
  Activity,
} from "lucide-react";

// Categorized FAQ Data
const faqCategories = [
  { id: "getting-started", name: "Getting Started", icon: BookOpen },
  { id: "account", name: "Account & Security", icon: Shield },
  { id: "meetings", name: "Meetings & Transcription", icon: Clock },
  { id: "ai-search", name: "AI & Knowledge Base", icon: Layers },
];

const faqs = [
  {
    category: "getting-started",
    q: "How do I create or join an organization?",
    a: "When you first sign up, you will land on the Organization Hub. You can click 'Create Organization' to spin up a new workspace as an Admin, or type in the name of an existing organization to request membership. If the organization is public, you can also browse the catalog and submit an access request.",
  },
  {
    category: "getting-started",
    q: "Is there a guest role on MeetOnMemory?",
    a: "Yes! Guest is the default role for users who have just registered and have not completed organization onboarding. Guests can view public organization profiles and browse the public directory to find their community.",
  },
  {
    category: "account",
    q: "How can I change my password?",
    a: "Navigate to Settings by clicking your avatar or using the sidebar, then locate the 'Security' section. Click 'Change Password' to trigger the password reset flow.",
  },
  {
    category: "account",
    q: "How do roles and permissions work?",
    a: "MeetOnMemory uses a Role-Based Access Control (RBAC) hierarchy: Owner (highest), Admin, Moderator, Member, and Guest (lowest). Permissions are bound to roles. For example, creating meetings requires at least a Moderator role, while managing integrations or billing requires Admin/Owner status.",
  },
  {
    category: "meetings",
    q: "What audio/video file formats are supported?",
    a: "We support popular media formats including MP3, MP4, WAV, M4A, AAC, and WEBM. The maximum upload size for standard files is 250MB, which can be extended for enterprise subscriptions.",
  },
  {
    category: "meetings",
    q: "How long does transcription take?",
    a: "Transcription and AI summary generation typically take 15-30% of the meeting duration. For example, a 60-minute meeting will be processed, indexed, and summarized within 10-15 minutes.",
  },
  {
    category: "ai-search",
    q: "What is Memory Consolidation?",
    a: "Memory Consolidation is the process where Google Gemini AI scans multiple meeting transcripts to build a structured, semantic knowledge graph. It automatically identifies contradictions, updates action items, and connects related business logic to give you a single source of truth.",
  },
  {
    category: "ai-search",
    q: "How does AI Semantic Search differ from text search?",
    a: "Traditional search looks for exact keyword matches. Semantic search uses vector embeddings (backed by Pinecone) to understand the *intent* and *context* of your query. Searching for 'who agreed to build the API' will find instances even if the transcript says 'developers accepted the backend tasks'.",
  },
];

// Troubleshooting Guides Data
const troubleshootingGuides = [
  {
    title: "Meeting Upload Fails mid-way",
    problem:
      "The file upload progress bar stops or shows a network error when uploading meeting recordings.",
    steps: [
      "Check your file size: Ensure the file does not exceed the 250MB limit for your plan.",
      "Check your connection: Large file uploads require a stable internet connection. If you are on VPN or proxy, try disabling it momentarily.",
      "Convert file format: If you are using a raw format, try converting the video to a compressed MP4 or MP3 audio file to decrease the size and speed up transmission.",
      "Retry using another browser: Sometimes browser extensions block continuous chunked uploads. Try running in an incognito window.",
    ],
    icon: AlertTriangle,
    severity: "warning",
  },
  {
    title: "Slack Notification Integration is not posting updates",
    problem:
      "Meeting alerts or action items are not syncing to your configured Slack channels.",
    steps: [
      "Verify Slack Workspace connection: Go to Organization Settings > Integrations, and make sure the Slack workspace is marked as connected.",
      "Check Channel Permissions: Ensure the MeetOnMemory Bot has been invited to the channel. You can type `/invite @MeetOnMemory` in Slack.",
      "Re-authorize Slack: If the token expired, click 'Reconnect' under settings to refresh workspace permissions.",
    ],
    icon: Settings,
    severity: "info",
  },
  {
    title: "AI Search returns no results",
    problem:
      "When querying the vector knowledge base, you receive a 'No results found' screen.",
    steps: [
      "Ensure transcripts are complete: Check if the meetings you uploaded have finished processing and show a 'Completed' status badge.",
      "Simplify query: Try searching for a broader concept or key names (e.g., 'API integration' instead of a very long sentence).",
      "Check membership access: Ensure you are logged into the correct organization. You can only search across meetings within your active workspace.",
    ],
    icon: Activity,
    severity: "info",
  },
];

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [activeTab, setActiveTab] = useState("faqs"); // "faqs" or "troubleshooting"

  // Live filter logic
  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesCategory =
        activeCategory === "all" || faq.category === activeCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return troubleshootingGuides;
    return troubleshootingGuides.filter(
      (guide) =>
        guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.steps.some((step) =>
          step.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );
  }, [searchQuery]);

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300 flex flex-col font-sans select-none">
      <Navbar />

      {/* Hero Search Section */}
      <section className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800 bg-linear-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950/20 pt-32 pb-16 px-4">
        {/* Subtle Background Blobs */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-blue-100/50 dark:bg-blue-900/10 blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-violet-100/30 dark:bg-violet-900/5 blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <HelpCircle className="w-4 h-4" /> Support Portal
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
            How can we help you today?
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base mb-8">
            Search our knowledge base for setup guides, FAQs, troubleshooting
            tips, and self-service articles.
          </p>

          {/* Search Box */}
          <div className="relative max-w-2xl mx-auto shadow-md rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-6 h-6 text-slate-400" />
            <input
              type="text"
              placeholder="Search for questions, terms, guides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all border-none text-base"
            />
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow w-full">
        {/* Navigation Tabs */}
        <div className="flex justify-center border-b border-slate-200 dark:border-slate-800 mb-10">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("faqs")}
              className={`pb-4 text-base font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "faqs"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Frequently Asked Questions
            </button>
            <button
              onClick={() => setActiveTab("troubleshooting")}
              className={`pb-4 text-base font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "troubleshooting"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Troubleshooting Guides
            </button>
          </div>
        </div>

        {/* 1. FAQs Tab Content */}
        {activeTab === "faqs" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Categories Card */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 h-fit space-y-1.5 shadow-xs">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-3">
                Categories
              </h3>
              <button
                onClick={() => setActiveCategory("all")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeCategory === "all"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                All FAQs
              </button>
              {faqCategories.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      activeCategory === cat.id
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Accordion Questions */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {activeCategory === "all"
                    ? "General Help"
                    : faqCategories.find((c) => c.id === activeCategory)?.name}
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                  {filteredFaqs.length} questions found
                </span>
              </div>

              {filteredFaqs.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                  <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4 animate-bounce" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                    No FAQs match your search
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Try searching for different terms or reset your filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFaqs.map((faq, index) => {
                    const isOpen = expandedFaq === index;
                    return (
                      <div
                        key={index}
                        className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300"
                      >
                        <button
                          onClick={() => toggleFaq(index)}
                          className="w-full flex items-center justify-between px-6 py-5 text-left font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <span className="pr-4">{faq.q}</span>
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          )}
                        </button>
                        <div
                          className={`transition-all duration-300 ease-in-out overflow-hidden ${
                            isOpen
                              ? "max-h-96 border-t border-slate-100 dark:border-slate-800"
                              : "max-h-0"
                          }`}
                        >
                          <div className="px-6 py-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30">
                            {faq.a}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Troubleshooting Guides Tab Content */}
        {activeTab === "troubleshooting" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                Step-by-Step Resolution Guides
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                {filteredGuides.length} guides available
              </span>
            </div>

            {filteredGuides.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <AlertTriangle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  No troubleshooting guides found
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Try typing a simpler word or check FAQ tab.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredGuides.map((guide, idx) => {
                  const Icon = guide.icon;
                  const borderClass =
                    guide.severity === "warning"
                      ? "border-l-4 border-l-amber-500 border-slate-200 dark:border-slate-800"
                      : "border-l-4 border-l-blue-500 border-slate-200 dark:border-slate-800";
                  const iconBg =
                    guide.severity === "warning"
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";

                  return (
                    <div
                      key={idx}
                      className={`bg-white dark:bg-slate-900/40 rounded-2xl p-6 shadow-sm border ${borderClass} hover:shadow-lg transition-all duration-300`}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div
                          className={`p-3 rounded-xl ${iconBg} flex-shrink-0`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {guide.title}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {guide.problem}
                          </p>
                        </div>
                      </div>

                      {/* Numbered Steps */}
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                          Action Checklist
                        </h4>
                        <ol className="space-y-3">
                          {guide.steps.map((step, stepIdx) => (
                            <li
                              key={stepIdx}
                              className="flex items-start gap-3 text-sm"
                            >
                              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                {stepIdx + 1}
                              </span>
                              <span className="text-slate-600 dark:text-slate-300">
                                {step}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Contact Support CTA Card */}
        <section className="mt-16 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-slate-900/50 dark:to-slate-800/50 rounded-3xl border border-indigo-100/50 dark:border-slate-800 p-8 sm:p-12 text-center shadow-md relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-2xl" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg mb-6">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
              Still have questions?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mb-8 max-w-md mx-auto">
              If you couldn't find the answers you need in our self-service
              center, our support team is happy to help you.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              Contact Support
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HelpCenter;
