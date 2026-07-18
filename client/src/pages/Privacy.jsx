import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  Shield,
  Search,
  ChevronRight,
  ChevronDown,
  Cookie,
  Clock,
  Lock,
  UserCheck,
  Server,
  Eye,
  HelpCircle,
  Check,
  FileText,
  Globe,
  RefreshCw,
  Sliders,
  AlertTriangle,
  Info,
  Mail,
  MapPin,
  FileLock,
  FileSignature
} from "lucide-react";

// Sections data
const sections = [
  {
    id: "introduction",
    title: "1. Introduction & Scope",
    icon: Globe,
    content: `Welcome to MeetOnMemory. We respect your privacy and are committed to protecting your personal data. This Privacy Policy describes how MeetOnMemory ("we", "us", or "our") collects, uses, processes, and protects your information when you use our web application, services, and associated websites (collectively, the "Service"). 

MeetOnMemory is an AI-powered knowledge management and collaboration platform designed to convert meeting recordings, transcripts, notes, and organizational documents into structured, searchable knowledge databases. This policy applies to all visitors, registered users, and organizations who access or use the Service.

By accessing or using our Service, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with the terms outlined here, please refrain from using MeetOnMemory.`,
  },
  {
    id: "dataCollect",
    title: "2. Data We Collect",
    icon: FileText,
    content: `To provide our intelligent meeting processing features, we collect several categories of information:

A. Account Registration Information:
When you register for an account, we collect your full name, email address, password hash, and profile picture (if provided). If you log in via third-party providers (such as Google), we receive authentication tokens and profile information authorized by that provider.

B. Meeting & Media Content:
To generate AI summaries, meeting minutes, and semantic indices, you upload meeting audio files, video recordings, textual meeting transcripts, meeting notes, and uploaded PDF/TXT/Word policy documents. This content may contain conversations, voices, slides, and shared screens of participants.

C. Metadata:
We collect administrative metadata related to your meetings, such as meeting title, description, date, duration, list of participants, and file size.

D. Usage and Technical Data:
We automatically collect technical data when you interact with the Service, including your IP address, browser type, operating system, pages visited, timestamps, clickstreams, and preferred language.`,
  },
  {
    id: "aiProcessing",
    title: "3. AI Processing & Third-Party Models",
    icon: Server,
    content: `MeetOnMemory utilizes advanced Large Language Models (LLMs) and artificial intelligence technology (such as Google Gemini APIs) to transcribe meeting audio, summarize transcripts, extract key decisions, and compile structured reports.

A. Processing Pipeline:
When an audio recording or transcript is uploaded, it is sent securely to our servers, parsed, and forwarded via encrypted connections (HTTPS) to our AI processing providers for analysis.

B. No Model Training:
We contractually ensure that the personal data, meeting audio, and meeting transcripts sent to third-party AI APIs (including Google Gemini API) are NOT used to train or improve public AI models. Your proprietary meeting intelligence remains exclusive to your organization.

C. Transcriptions:
Audio files are transcribed using high-accuracy speech-to-text models. During this process, acoustic data is converted into text data for indexing and summarization.`,
  },
  {
    id: "vectorStorage",
    title: "4. Vector Database & Semantic Indexes",
    icon: Sliders,
    content: `To power our natural language Smart AI Search, MeetOnMemory uses vector search technology:

A. Embedding Generation:
Transcripts and policy documents are broken down into chunks, and each chunk is converted into a high-dimensional vector representation (embedding) using machine learning embedding models.

B. Vector Database (Pinecone):
These embeddings, along with minimal metadata reference keys (such as chunk text, meeting ID, and organization ID), are stored in Pinecone, a specialized vector database. This allows users to ask natural language questions (e.g., "What was our budget decision?") and retrieve relevant segments instantly.

C. Isolation:
We partition vectors by Organization ID. This guarantees logical isolation, ensuring that users can never retrieve search results or metadata from organizations to which they do not belong.`,
  },
  {
    id: "dataUsage",
    title: "5. How We Use Your Information",
    icon: Info,
    content: `We use the collected information for the following business purposes:

- Service Delivery: To create your user account, manage organization workspaces, and host real-time collaborative meetings.
- AI Summarization & Extraction: To transcribe audio, summarize key highlights, generate action items, and detect policy compliance.
- Semantic Search: To maintain and query vector indexes so you can quickly retrieve past meeting decisions.
- Communications: To send system notifications, password reset links, invitations, and updates about your workspace activities.
- Security & Compliance: To detect and prevent fraudulent access, monitor system performance, and enforce role-based access control.
- Product Improvement: To analyze anonymous usage trends and optimize our web application interface, page response times, and processing pipelines.`,
  },
  {
    id: "orgAccess",
    title: "6. Workspace Access Controls",
    icon: FileLock,
    content: `MeetOnMemory is built around collaborative Organizations. It is important to understand how your data is shared inside these workspaces:

A. Role-Based Access Control (RBAC):
Each organization has owners, administrators, and members. Administrators control who has access to meeting records, transcripts, AI summaries, and reports.
- Meeting recordings and summaries uploaded to an organization workspace are generally visible to all authorized members of that organization unless restricted by an administrator.
- If you leave or are removed from an organization, you will immediately lose access to that workspace's meetings, policies, and summaries.

B. Public Profiles:
Organizations can configure a public profile page showing public organization details, which is visible to non-registered visitors. No meeting audio, private transcripts, or AI summaries are ever published on public profiles.`,
  },
  {
    id: "dataRetention",
    title: "7. Data Retention & Deletion",
    icon: Clock,
    content: `We retain your personal data and meeting content only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, or as required by law.

A. User-Initiated Deletion:
- Users can edit or delete their profile information at any time.
- Organization administrators can permanently delete uploaded meeting recordings, transcripts, summaries, and policy documents from the workspace.
- When an administrator deletes a record, we remove the raw files from our storage buckets, delete the document fields from our MongoDB database, and purge the associated vector embeddings from the Pinecone vector indexes.

B. Account Closure:
If you request the deletion of your user account, we will erase your registration details. However, meeting records or summaries you uploaded that are part of an active team workspace may be retained at the discretion of the organization administrator, as they constitute shared institutional knowledge.`,
  },
  {
    id: "cookiesStorage",
    title: "8. Cookies & Local Storage",
    icon: Cookie,
    content: `We use cookies and browser local storage to enhance your experience, maintain security, and remember your preferences:

A. Essential Cookies:
These are required for the basic operation of the Service, such as keeping you authenticated, protecting API endpoints, and maintaining CSRF protection tokens.

B. Functional Storage:
We use browser local storage to store configuration settings, such as your selected UI theme (light vs. dark mode) and your active language (English vs. Hindi).

C. Analytical Cookies:
With your consent, we use analytics cookies to compile aggregated statistics regarding website visits, referral pages, and feature utilization. You can manage your preferences using our interactive Consent Manager on this page.`,
  },
  {
    id: "dataSecurity",
    title: "9. Data Security & Encryption",
    icon: Lock,
    content: `The security of your data is paramount to us. We implement industry-standard security measures to guard against unauthorized access, alteration, disclosure, or destruction:

A. Encryption:
- Data in Transit: All data sent between the browser and our servers is encrypted using Secure Sockets Layer/Transport Layer Security (SSL/TLS 1.2 or TLS 1.3) protocols.
- Data at Rest: Sensitive database records, user details, and uploaded media files are stored on secure cloud databases that utilize encryption at rest.

B. Access Controls:
Our server APIs verify authentication tokens and check strict permission matrices before returning any resource. Database connections are restricted to authorized server hosts, and logging systems track administrative access events.

C. Vulnerability Management:
We perform periodic packages audits and utilize automated code scanning tools to identify and remediate security vulnerabilities in our dependencies.`,
  },
  {
    id: "intlTransfers",
    title: "10. International Transfers",
    icon: Globe,
    content: `MeetOnMemory operates globally, and our server infrastructure is primarily located in secure cloud data centers in the United States and Europe.

If you access the Service from outside these regions, please note that the information we collect may be transferred to, stored, and processed in databases located in countries where data protection laws may differ from those in your jurisdiction.

We implement standard contractual clauses and align with GDPR-compliant frameworks to ensure that your data receives an equivalent level of protection wherever it is processed.`,
  },
  {
    id: "userRights",
    title: "11. Your Rights & Choices",
    icon: UserCheck,
    content: `Depending on your location (such as the European Economic Area under GDPR or California under CCPA), you possess specific legal rights regarding your personal data:

- Right of Access: You have the right to request copies of the personal data we hold about you.
- Right to Rectification: You can request that we correct any information you believe is inaccurate or incomplete.
- Right to Erasure ("Right to be Forgotten"): You can request the erasure of your personal data under certain conditions.
- Right to Restrict Processing: You can ask us to restrict the processing of your personal data.
- Right to Data Portability: You have the right to request that we transfer the data we have collected to another organization, or directly to you, in a machine-readable format.
- Right to Object: You have the right to object to our processing of your data for direct marketing or based on legitimate interests.

To exercise any of these rights, please contact our privacy desk at privacy@meetonmemory.com. We respond to all requests within 30 days.`,
  },
  {
    id: "childrenPrivacy",
    title: "12. Children's Privacy",
    icon: AlertTriangle,
    content: `Our Service is not directed to individuals under the age of 16. We do not knowingly collect or solicit personal information from children under 16. 

If we learn that we have accidentally collected personal data from a child under 16 without verification of parental consent, we will take immediate steps to delete that information from our databases and vector storage caches. If you believe a child under 16 has provided personal data to us, please notify us immediately.`,
  },
  {
    id: "policyChanges",
    title: "13. Changes to this Policy",
    icon: FileSignature,
    content: `We may update our Privacy Policy from time to time to reflect changes in our technology, business practices, or regulatory requirements. 

When we make changes, we will post the updated policy on this page and revise the "Last Updated" date at the top. If the changes are material, we will provide a more prominent notice (such as sending an email notification or displaying a banner inside the user dashboard) before the changes go into effect.

We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.`,
  },
  {
    id: "contactUs",
    title: "14. Contact Us & Support",
    icon: Mail,
    content: `If you have any questions, comments, or concerns about this Privacy Policy, our data processing workflows, or if you wish to report a security vulnerability, please get in touch with us:

- Email: privacy@meetonmemory.com
- Security Reporting: security@meetonmemory.com
- Office Address: MeetOnMemory Legal Department, 548 Market St, Suite 4839, San Francisco, CA 94104

We are committed to resolving any complaints or inquiries about your privacy and our collection of personal data in a transparent and cooperative manner.`,
  },
];

const Privacy = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("introduction");
  const [expandedFaq, setExpandedFaq] = useState(null);
  
  // Consent Manager State
  const [cookieConsent, setCookieConsent] = useState({
    essential: true,
    analytics: true,
    functional: false,
    aiModelTraining: false,
  });
  const [showConsentToast, setShowConsentToast] = useState(false);

  // References for scroll detection
  const sectionRefs = useRef({});
  // FAQ Accordion Data
  const faqs = [
    {
      q: "Does MeetOnMemory record my voice without my consent?",
      a: "No. MeetOnMemory only processes audio and video files that you or an administrator of your organization explicitly upload to the platform, or meetings conducted through our virtual Meeting Room where recording has been explicitly enabled and notified to participants.",
    },
    {
      q: "Are my transcripts used to train AI models?",
      a: "Absolutely not. Under our developer agreements with AI API providers (such as Google Gemini), all data passed through our secure APIs is marked for private zero-retention processing. Your data is never ingested into public models or training databases.",
    },
    {
      q: "Where is my data physically stored?",
      a: "Our core databases are hosted securely on MongoDB Atlas cloud servers located in the US-East region. Vector search indexes are hosted in Pinecone's secure data centers. All static media files are stored in encrypted cloud storage buckets with access controls.",
    },
    {
      q: "How do I request complete deletion of my organization's data?",
      a: "Organization owners can request complete workspace deletion by navigating to the Settings page and choosing 'Delete Organization'. This triggers a cascading delete sequence that purges database documents, files, and vector indices within 48 hours.",
    },
  ];

  // Scroll detection to highlight active table of contents
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;

      for (let i = 0; i < sections.length; i++) {
        const sectionId = sections[i].id;
        const element = sectionRefs.current[sectionId];
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle sidebar link clicks with smooth offset scroll
  const scrollToSection = (id) => {
    const element = sectionRefs.current[id];
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: "smooth",
      });
      setActiveSection(id);
    }
  };

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase();
    return sections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(query) ||
        sec.content.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Cookie Preference Save Handler
  const handleSaveConsent = () => {
    setShowConsentToast(true);
    setTimeout(() => {
      setShowConsentToast(false);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 flex flex-col">
      <Navbar />

      {/* Hero Header */}
      <header className="relative overflow-hidden bg-linear-to-br from-indigo-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-gray-100 dark:border-slate-800 pt-28 pb-16">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-indigo-300 dark:bg-indigo-900/30 blur-3xl animate-blob" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-blue-300 dark:bg-blue-900/20 blur-3xl animate-blob animation-delay-2000" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/80 dark:bg-indigo-950/50 border border-indigo-200/50 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4 animate-fade-in">
            <Shield className="w-3.5 h-3.5" /> Trust & Compliance
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-gray-500 dark:text-slate-400">
            Learn how we handle, process, and safeguard your meeting data, transcriptions, and organizational information.
          </p>

          <div className="mt-8 max-w-md mx-auto relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search policy sections, keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm text-sm"
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
              <Clock className="w-3.5 h-3.5" /> Last Updated: July 16, 2026
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> Version: 1.2
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Navigation Sidebar */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-28 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm max-h-[calc(100vh-140px)] overflow-y-auto">
              <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5 px-2">
                <FileSignature className="w-4 h-4 text-indigo-500" /> Document Outline
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
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                          : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/30"
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`} />
                      <span className="truncate">{sec.title.split(". ")[1]}</span>
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto text-indigo-600 dark:text-indigo-400 shrink-0 animate-pulse" />}
                    </button>
                  );
                })}
              </nav>

              <hr className="my-5 border-gray-100 dark:border-slate-700/60" />

              {/* Sidebar Quick Card */}
              <div className="bg-linear-to-tr from-indigo-600 to-indigo-700 text-white rounded-xl p-4.5 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 bottom-0 translate-y-6 translate-x-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Need assistance?
                </h4>
                <p className="text-[11px] text-indigo-100 mt-2 leading-relaxed">
                  Have questions about GDPR data deletes or Gemini API security scopes? Contact our compliance help desk.
                </p>
                <a
                  href="mailto:privacy@meetonmemory.com"
                  className="inline-block mt-3.5 bg-white text-indigo-700 font-semibold text-xs px-3.5 py-1.5 rounded-md hover:bg-indigo-50 transition"
                >
                  Contact Officer
                </a>
              </div>
            </div>
          </aside>

          {/* Right Column: Dynamic Clauses and Modules */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Warning Info box if searching */}
            {searchQuery && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Search Filter Active</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Showing sections that match "{searchQuery}". Clear search to view full policy structure.
                  </p>
                </div>
              </div>
            )}

            {/* Document Content List */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-10">
              {filteredSections.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">No matches found</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                    Try searching for different terms like 'retention', 'Gemini', 'delete', or 'cookies'.
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition"
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
                      ref={(el) => {
                        sectionRefs.current[sec.id] = el;
                      }}
                      className="scroll-mt-24 border-b border-gray-100 last:border-0 dark:border-slate-700/60 pb-8 last:pb-0"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                          <Icon className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          {sec.title}
                        </h2>
                      </div>
                      <div className="text-sm sm:text-base text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-line space-y-4">
                        {sec.content}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Cookie & Privacy Consent Preferences simulator */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <Cookie className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Privacy Preference Center
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Customize your cookie consent parameters and AI training participation.
                  </p>
                </div>
              </div>

              <div className="space-y-4 mt-6">
                {/* Preference Option 1 */}
                <div className="flex items-start justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/20 transition">
                  <div className="max-w-[80%]">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                      Strictly Essential Data
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-full">
                        Required
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Required for key app features, API validation tokens, organization workspace loading, and login security credentials.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={cookieConsent.essential}
                    disabled
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 opacity-60 cursor-not-allowed mt-1"
                  />
                </div>

                {/* Preference Option 2 */}
                <div className="flex items-start justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/20 transition">
                  <div className="max-w-[80%]">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white">
                      Analytics Tracking Cookies
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Allows us to gather statistics on visitor count, landing page scroll patterns, and page load issues so we can refine performance.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={cookieConsent.analytics}
                    onChange={(e) =>
                      setCookieConsent({
                        ...cookieConsent,
                        analytics: e.target.checked,
                      })
                    }
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-1"
                  />
                </div>

                {/* Preference Option 3 */}
                <div className="flex items-start justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/20 transition">
                  <div className="max-w-[80%]">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white">
                      Functional Memory Customization
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Retains interface adjustments like language settings (Hindi vs. English) and dark/light UI mode preferences.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={cookieConsent.functional}
                    onChange={(e) =>
                      setCookieConsent({
                        ...cookieConsent,
                        functional: e.target.checked,
                      })
                    }
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-1"
                  />
                </div>

                {/* Preference Option 4 */}
                <div className="flex items-start justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/20 transition">
                  <div className="max-w-[80%]">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                      AI Model Training Participation
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 rounded-full">
                        Opt-in Only
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Check this box only if you want to allow anonymous, de-identified meeting summaries to contribute to external developer evaluations. We default this to OFF.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={cookieConsent.aiModelTraining}
                    onChange={(e) =>
                      setCookieConsent({
                        ...cookieConsent,
                        aiModelTraining: e.target.checked,
                      })
                    }
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-1"
                  />
                </div>
              </div>

              {/* Actions Footer for Cookie Preference */}
              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
                <p className="text-[11px] text-gray-400 dark:text-slate-500 max-w-sm leading-normal">
                  Decisions saved here affect this local browser session. You can update or retract consent at any time.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setCookieConsent({
                        essential: true,
                        analytics: false,
                        functional: false,
                        aiModelTraining: false,
                      })
                    }
                    className="px-3.5 py-1.5 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                  >
                    Reject All Non-Essential
                  </button>
                  <button
                    onClick={handleSaveConsent}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" /> Save Preferences
                  </button>
                </div>
              </div>

              {/* Simulated Consent Status Success Toast */}
              {showConsentToast && (
                <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-400 animate-fade-in">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  <span>Preferences saved successfully! Your browser storage parameters have been updated.</span>
                </div>
              )}
            </section>

            {/* Expandable FAQs Accordion */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Privacy FAQs
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
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700/60 text-xs sm:text-sm text-gray-500 dark:text-slate-400 leading-relaxed animate-slide-down">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Version History Log */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Revision History
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Track the modifications we have implemented in this privacy mandate over time.
                  </p>
                </div>
              </div>

              <div className="relative pl-6 border-l-2 border-indigo-100 dark:border-indigo-950/80 space-y-6">
                {/* Timeline Node 1 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-500 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.2
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">July 16, 2026 (Current)</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Added clauses outlining Pinecone vector isolation partitioning and explicit details clarifying Google Gemini API processing data-sharing restrictions.
                  </p>
                </div>

                {/* Timeline Node 2 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.1
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">March 04, 2026</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Incorporated compliance standards for role-based workspace structures (RBAC) and updated the policy retention criteria for MongoDB Atlas cloud buckets.
                  </p>
                </div>

                {/* Timeline Node 3 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.0
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">November 10, 2025</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Initial publication of terms regulating platform transcription processing, user account registration, and essential cookie tracking setups.
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* Quick Footer banner redirection */}
      <div className="bg-gray-100 dark:bg-slate-900 border-t border-gray-200/80 dark:border-slate-800/80 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
            Have questions about standard contract clauses or DPA agreements?
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-semibold">
            <a
              href="mailto:dpo@meetonmemory.com"
              className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
            >
              Contact Data Protection Officer
            </a>
            <Link
              to="/"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
