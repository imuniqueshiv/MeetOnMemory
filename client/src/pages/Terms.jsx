import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  Scale,
  Search,
  ChevronRight,
  ChevronDown,
  Clock,
  BookOpen,
  UserCheck,
  FileText,
  ShieldAlert,
  HelpCircle,
  Check,
  Globe,
  RefreshCw,
  Edit3,
  AlertTriangle,
  Info,
  CreditCard,
  Cpu,
  Fingerprint,

  Award,
  Server
} from "lucide-react";

// Sections data
const sections = [
  {
    id: "agreement",
    title: "1. Agreement & Eligibility",
    icon: BookOpen,
    content: `These Terms of Service ("Terms") constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and MeetOnMemory ("we", "us", or "our"), concerning your access to and use of the MeetOnMemory web application and associated services (the "Service").

By accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by all of these Terms. If you do not agree with all of these Terms, you are explicitly prohibited from using the Service and must discontinue use immediately.

Eligibility:
To register for an account and use the Service, you must be at least 16 years of age (or the minimum legal age in your jurisdiction to consent to the processing of personal data). By creating an account, you warrant that you possess the legal capacity to enter into a binding contract and that all registration information you submit is accurate and truthful.`,
  },
  {
    id: "serviceDesc",
    title: "2. Service Description",
    icon: Cpu,
    content: `MeetOnMemory provides an AI-powered workspace platform that processes meeting records, media files, and transcripts. 

Core features include:
- Transcription Services: Converting voice recordings and video files into text transcripts.
- AI Summarization: Generating Minutes of Meeting (MoM), summary reports, decision logs, and action items using machine learning models.
- Semantic Search: Vectorizing document segments (transcripts and uploaded policies) to permit natural language queries.
- Collaborative Workspaces: Setting up team organizations, browsing profiles, and sharing institutional knowledge.

We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice. We are not liable to you or any third party for any changes, pricing updates, or suspension of the Service.`,
  },
  {
    id: "accounts",
    title: "3. User Registration & Security",
    icon: UserCheck,
    content: `To access most features of MeetOnMemory, you must create a user account. 

A. Account Creation:
You agree to provide current, complete, and accurate registration information. You are solely responsible for maintaining the confidentiality of your account password and authentication tokens.

B. Responsibility for Workspace Actions:
If you create an Organization, you are designated as the Owner or Administrator. You are responsible for all actions taken by members you invite to your workspace. Any breach of security or unauthorized access to your account must be reported to support@meetonmemory.com immediately.

C. Account Integrity:
You may not select a username or organization name that impersonates another person, violates a third party's trademark rights, or is intentionally offensive. We reserve the right to reclaim or change usernames or organization slugs that violate these guidelines.`,
  },
  {
    id: "acceptableUse",
    title: "4. Acceptable Use Policy",
    icon: ShieldAlert,
    content: `You agree to use MeetOnMemory only for lawful purposes. You are strictly prohibited from:

- Non-Consensual Recording: Uploading or transcribing meetings, audio recordings, or video sessions without the express, legally required consent of all participating speakers.
- System Overload: Attempting to bypass rate limits, trigger excessive AI processing calls, or engage in denial-of-service activities.
- Unauthorized Harvesting: Scoping, scraping, or systematically collecting user profile data, transcripts, or organization directories.
- Security Circumvention: Trying to probe, scan, or test the vulnerability of our API endpoints, MongoDB databases, or Pinecone vector nodes.
- Malware Transmission: Uploading files containing viruses, Trojan horses, ransomware, or malicious script sequences.
- Illegal Content: Storing or processing content that promotes hate speech, violence, discrimination, or infringes on patent, trademark, or copyright laws.`,
  },
  {
    id: "billingCredits",
    title: "5. Subscription & AI Credits",
    icon: CreditCard,
    content: `Some features of MeetOnMemory require active subscriptions or purchase of AI transcription credits.

A. Billing:
By selecting a paid subscription tier or purchasing credit bundles, you authorize us to charge the designated payment method for all recurring charges, fees, and applicable taxes. All transactions are processed through secure third-party payment gateways.

B. Credits Balance:
AI Credits correspond to processed audio minutes. Minutes are deducted from your balance based on the length of the uploaded media file. Credit balances are non-refundable and do not hold cash value.

C. Cancellation:
You can cancel your subscription at any time through the dashboard settings. Your access to paid features will remain active until the end of the current billing cycle. No partial refunds are issued for unused billing intervals.`,
  },
  {
    id: "intellectualProperty",
    title: "6. Intellectual Property Rights",
    icon: Award,
    content: `A. Your Content:
You retain all ownership, copyright, and proprietary rights in the raw audio recordings, video files, text transcripts, and documents that you upload to MeetOnMemory (collectively, "User Content"). By uploading User Content, you grant us a limited, global, non-exclusive license to process, partition, vectorize, and summarize the content solely for the purpose of delivering the Service to you and your authorized organization members.

B. AI-Generated Outputs:
MeetOnMemory claims no ownership over the AI summaries, action items, meeting minutes, or compliance reports generated from your transcripts. They are deemed derivative works of your User Content.

C. Platform IP:
The Service's interface design, codebase, logos, structural database schemas, vector indexing algorithms, and documentation are the exclusive property of MeetOnMemory and are protected by international copyright and intellectual property laws. You may not copy, reverse-engineer, or adapt any part of our platform.`,
  },
  {
    id: "aiLimits",
    title: "7. API Usage & AI Limits",
    icon: Server,
    content: `Our service relies on third-party APIs (such as Google Gemini APIs) and cloud databases (like Pinecone and MongoDB Atlas).

A. API Boundaries:
To ensure stable performance for all organizations, we enforce rate limits on AI queries, semantic search operations, document uploads, and real-time collaborative edits.

B. Model Limitations:
AI models compile text based on probabilistic patterns. You acknowledge that AI-generated summaries, meeting minutes, and compliance audits may occasionally contain inaccuracies, omissions, or misinterpretations ("hallucinations"). You are responsible for reviewing and validating the accuracy of all AI-generated outputs before relying on them for business decisions.`,
  },
  {
    id: "liabilityLimit",
    title: "8. Limitation of Liability",
    icon: AlertTriangle,
    content: `To the maximum extent permitted by applicable law, in no event shall MeetOnMemory, its directors, employees, partners, or API suppliers be liable for:

- Any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data corruption, business interruption, or loss of goodwill.
- Damages resulting from your access to or inability to access the Service.
- Unauthorized access, use, or alteration of your transcripts, MongoDB documents, or Pinecone vector indices.
- Any errors, hallucinations, or inaccuracies in the AI-generated summaries, transcripts, or compliance scores.
- Any loss or deletion of files, recordings, or organizational data.

Our cumulative liability for all claims arising out of or relating to these Terms or the use of the Service shall not exceed the total amount paid by you to MeetOnMemory in the twelve (12) months preceding the event giving rise to the claim.`,
  },
  {
    id: "indemnification",
    title: "9. Indemnification",
    icon: Scale,
    content: `You agree to defend, indemnify, and hold harmless MeetOnMemory, its contractors, licensors, and their respective directors, officers, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt, and expenses (including legal fees) arising from:

- Your use of and access to the Service.
- Any violation of these Terms, including the Acceptable Use Policy.
- Any claim that your User Content (recordings, transcripts, policies) infringes the intellectual property rights or privacy rights of a third party.
- Your failure to obtain legally required consent from all participants before recording or transcribing a meeting.`,
  },
  {
    id: "disclaimers",
    title: "10. Disclaimers of Warranties",
    icon: Globe,
    content: `Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. MeetOnMemory expressly disclaims all warranties of any kind, whether express or implied, including, but not limited to, the implied warranties of merchantability, fitness for a particular purpose, non-infringement, and course of performance.

We do not warrant that:
- The Service will function uninterrupted, secure, or available at any specific time or location.
- Any errors or bugs in the software will be corrected immediately.
- The Service, including transcription algorithms and vector databases, is free of viruses or other harmful components.
- The AI-generated summaries, transcripts, and meeting analysis will meet your business requirements or achieve absolute accuracy.`,
  },
  {
    id: "termination",
    title: "11. Termination of Service",
    icon: ShieldAlert,
    content: `We may terminate or suspend your account, access to the Service, or delete your organization workspaces immediately, without prior notice or liability, under our sole discretion, for any reason, including but not limited to:

- A breach of any provision of these Terms (such as non-consensual recording or API abuse).
- Failure to pay subscription fees.
- Requests by law enforcement or government agencies.
- Technical or security issues.

Upon termination, your right to use the Service will immediately cease. If you wish to delete your account, you can do so through the account settings. All provisions of these Terms which by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.`,
  },
  {
    id: "governingLaw",
    title: "12. Governing Law & Arbitration",
    icon: Scale,
    content: `These Terms shall be governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.

Any dispute, controversy, or claim arising out of or relating to these Terms, including the formation, validity, binding effect, interpretation, performance, breach, or termination thereof, shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) in accordance with its Commercial Arbitration Rules. 

The arbitration shall take place in San Francisco, California, and the language of arbitration shall be English. The arbitrator's award shall be final and binding, and judgment on the award may be entered in any court having jurisdiction thereof.`,
  },
  {
    id: "severability",
    title: "13. Severability & Entire Agreement",
    icon: FileText,
    content: `These Terms, along with our Privacy Policy and any subscription agreements, constitute the entire agreement between you and MeetOnMemory regarding your use of the Service, superseding any prior agreements or understandings.

If any provision of these Terms is found to be unenforceable or invalid by an arbitrator or court of competent jurisdiction, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions of these Terms shall remain in full force and effect.

Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.`,
  },
  {
    id: "changes",
    title: "14. Changes to Terms",
    icon: RefreshCw,
    content: `We reserve the right, at our sole discretion, to modify or replace these Terms at any time. 

If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. Notice may be delivered via email, posted on our landing page, or displayed within your dashboard workspace.

What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, please stop using the Service.`,
  },
];

const Terms = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("agreement");
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Signature Simulator State
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("member");
  const [agreedToAll, setAgreedToAll] = useState(false);
  const [signedTerms, setSignedTerms] = useState(false);
  const [signatureDate, setSignatureDate] = useState("");

  // References for scroll detection
  const sectionRefs = useRef({});
  // FAQ Accordion Data
  const faqs = [
    {
      q: "Am I legally allowed to record meetings and upload them?",
      a: "Depending on your jurisdiction, recording laws vary. Many regions require 'two-party' or 'all-party' consent, meaning every participant in the meeting must agree to be recorded. You must ensure you have obtained explicit consent from all speakers before uploading media files to MeetOnMemory.",
    },
    {
      q: "Who owns the copyright of the AI-generated summaries and transcripts?",
      a: "You do. MeetOnMemory treats all AI outputs as derivative works of your raw uploads. We do not claim any copyrights or IP ownership over your summaries, meeting minutes, or action logs.",
    },
    {
      q: "Is there a limit to how many files my organization can upload?",
      a: "Yes. Limits depend on your subscription plan. Free workspaces have cap limits on monthly transcription minutes, vector indexing size (Pinecone storage), and document count (MongoDB storage). You can upgrade your plan in the settings dashboard for higher limits.",
    },
    {
      q: "What happens to our workspace files if we cancel our subscription?",
      a: "If you cancel your subscription, your account will revert to the free tier at the end of the billing cycle. If your storage exceeds the free tier limits, we will preserve your data for a grace period of 30 days, after which some files or vector records may be locked or archived.",
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

  // Signature Simulator Submit Handler
  const handleSignatureSubmit = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setSignedTerms(true);
    const dateStr = new Date().toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    setSignatureDate(dateStr);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 flex flex-col">
      <Navbar />

      {/* Hero Header */}
      <header className="relative overflow-hidden bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-gray-100 dark:border-slate-800 pt-28 pb-16">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full bg-blue-300 dark:bg-blue-900/30 blur-3xl animate-blob" />
          <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-indigo-300 dark:bg-indigo-900/20 blur-3xl animate-blob animation-delay-2000" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 dark:bg-blue-950/50 border border-blue-200/50 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4 animate-fade-in">
            <Scale className="w-3.5 h-3.5" /> Terms & Conditions
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
            Terms of Service
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-gray-500 dark:text-slate-400">
            Please read these terms carefully before accessing or using our collaborative AI knowledge platform.
          </p>

          <div className="mt-8 max-w-md mx-auto relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search legal clauses, keywords..."
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
                <FileText className="w-4 h-4 text-blue-500" /> Terms Navigation
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
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto text-blue-600 dark:text-blue-400 shrink-0 animate-pulse" />}
                    </button>
                  );
                })}
              </nav>

              <hr className="my-5 border-gray-100 dark:border-slate-700/60" />

              {/* Sidebar Info Card */}
              <div className="bg-linear-to-tr from-blue-600 to-indigo-700 text-white rounded-xl p-4.5 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 bottom-0 translate-y-6 translate-x-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4" /> Legal Repository
                </h4>
                <p className="text-[11px] text-blue-100 mt-2 leading-relaxed">
                  MeetOnMemory operates under strict California state digital services codes. All transcriptions are secured via private channels.
                </p>
                <a
                  href="mailto:legal@meetonmemory.com"
                  className="inline-block mt-3.5 bg-white text-blue-700 font-semibold text-xs px-3.5 py-1.5 rounded-md hover:bg-blue-50 transition"
                >
                  Contact Counsel
                </a>
              </div>
            </div>
          </aside>

          {/* Right Column: Clauses and Modules */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Search warning */}
            {searchQuery && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex gap-3 text-sm text-blue-700 dark:text-blue-300 animate-fade-in">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Search Filter Active</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Showing clauses that match "{searchQuery}". Clear query to view complete Terms of Service.
                  </p>
                </div>
              </div>
            )}

            {/* Main legal document */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-10">
              {filteredSections.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3 animate-bounce" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">No matches found</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                    Try searching for different terms like 'recording', 'Gemini', 'liable', or 'billing'.
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
                      ref={(el) => {
                        sectionRefs.current[sec.id] = el;
                      }}
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
                      <div className="text-sm sm:text-base text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-line space-y-4">
                        {sec.content}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Signature Agreement Simulator */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Agreement Acceptance Simulator
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Demonstrate and simulate your organization's legal acceptance tracking.
                  </p>
                </div>
              </div>

              {!signedTerms ? (
                <form onSubmit={handleSignatureSubmit} className="space-y-4 mt-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Authorized Signee Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jane Doe"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                        Organization Role
                      </label>
                      <select
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value)}
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="owner">Organization Owner</option>
                        <option value="admin">Administrator</option>
                        <option value="member">Team Member</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          required
                          checked={agreedToAll}
                          onChange={(e) => setAgreedToAll(e.target.checked)}
                          className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        I read and accept all 14 sections
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" /> Sign Terms Agreement
                  </button>
                </form>
              ) : (
                <div className="mt-6 p-6 border-2 border-dashed border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl text-center space-y-4 animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-gray-900 dark:text-white">
                      Agreement Digitally Signed
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      A simulated digital audit signature has been compiled for your local state browser session.
                    </p>
                  </div>

                  <div className="max-w-md mx-auto grid grid-cols-2 gap-4 text-left p-3.5 bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-xl text-xs">
                    <div>
                      <span className="text-gray-400">Signatory:</span>
                      <p className="font-bold text-gray-700 dark:text-slate-300 mt-0.5">{userName}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Role:</span>
                      <p className="font-bold text-gray-700 dark:text-slate-300 mt-0.5 capitalize">{userRole}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Signed Time:</span>
                      <p className="font-bold text-gray-700 dark:text-slate-300 mt-0.5">{signatureDate}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Scope Status:</span>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Fully Compliant
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSignedTerms(false);
                      setUserName("");
                      setAgreedToAll(false);
                    }}
                    className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/60 transition"
                  >
                    Reset & Sign Again
                  </button>
                </div>
              )}
            </section>

            {/* FAQs Accordion */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Terms FAQs
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Quick clarifications regarding service limits and copyright boundaries.
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

            {/* Version timeline */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Revision History
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Timeline logs detailing previous versions of these guidelines.
                  </p>
                </div>
              </div>

              <div className="relative pl-6 border-l-2 border-blue-100 dark:border-blue-950/80 space-y-6">
                {/* Timeline Node 1 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.2
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">July 16, 2026 (Current)</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Revised AI models limitations clause to specify Gemini rate rules, and expanded Intellectual Property clause to explicitly clarify user copyright ownership of summary outputs.
                  </p>
                </div>

                {/* Timeline Node 2 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.1
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">March 04, 2026</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Incorporated arbitration clauses for commercial disputes under AAA guidelines, and structured organizational account admin duties.
                  </p>
                </div>

                {/* Timeline Node 3 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.0
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">November 10, 2025</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Initial launch of services regulating subscription rates, registration safety limits, and acceptable recording consent compliance.
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
            Have questions about standard contract clauses or transcription billing?
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-semibold">
            <a
              href="mailto:legal@meetonmemory.com"
              className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
            >
              Contact Legal Office
            </a>
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

export default Terms;
