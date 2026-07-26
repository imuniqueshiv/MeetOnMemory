import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  Shield,
  Search,
  ChevronRight,
  ChevronDown,
  Clock,
  Lock,
  Server,
  Terminal,
  Activity,
  Cpu,
  Key,
  Database,
  Layers,
  HelpCircle,
  Check,
  RefreshCw,
  Info,
  Sliders,
  AlertOctagon,
  UserCheck,
  Scale,
  Globe
} from "lucide-react";

// Sections data
const sections = [
  {
    id: "philosophy",
    title: "1. Security Philosophy",
    icon: Shield,
    content: `At MeetOnMemory, we believe security is not an afterthought—it is a core pillar of our system. Because our platform transcribes corporate audio files, indexes sensitive summaries, and parses legal organizational policies, we maintain a robust, defense-in-depth posture to secure your information.

Our engineering team operates under a Secure Development Lifecycle (SDL), which mandates automated static application security testing (SAST), code reviews, and dependency vulnerability scanning on every branch before deployment.

We default to structural isolation. Every file, transcript segment, summary block, and database table is structured to be accessible only by verified, role-validated accounts inside authorized organizations.`,
  },
  {
    id: "encryption",
    title: "2. Data Encryption Standards",
    icon: Key,
    content: `We protect your data both in transit and at rest using modern, industry-standard cryptographic algorithms:

A. Data in Transit:
All communications between your browser and our servers are encrypted using Transport Layer Security (TLS 1.2 or TLS 1.3) protocols. We enforce HTTP Strict Transport Security (HSTS) to prevent downgrade attacks and mandate secure HTTPS routing.

B. Data at Rest:
- Database Storage: Our primary MongoDB Atlas cloud databases use Advanced Encryption Standard with a 256-bit key length (AES-256) at the storage engine layer.
- Media Storage: Meeting recordings, video playbacks, and policy PDFs are stored in encrypted cloud storage buckets. Keys are managed securely via automated cloud key management systems.
- Column-Level Hashing: Highly sensitive user fields, such as password hashes, are computed using bcrypt, a password-hashing function with randomized salt inputs.`,
  },
  {
    id: "aiProcessing",
    title: "3. Private AI Data Processing",
    icon: Cpu,
    content: `A core concern of teams using AI tools is the leakage of intellectual property into public models. We address this directly:

A. Zero Data Retention:
We route transcription and summarization API requests (including Google Gemini API endpoints) through enterprise developer agreements. Under these agreements, your uploaded meeting transcripts, notes, and documents are processed in memory and are NOT retained by the AI provider.

B. No Model Training:
Your data is NEVER used to train, evaluate, or improve public machine learning models or third-party Large Language Models (LLMs). The summary outputs compiled for your meetings belong exclusively to your organization.

C. Encryption:
All payloads sent to AI endpoints are encrypted using TLS 1.3, guaranteeing secure server-to-server transfers.`,
  },
  {
    id: "vectorIsolation",
    title: "4. Vector Database & Index Isolation",
    icon: Layers,
    content: `To enable instant Smart Search, meeting text chunks are processed into vector embeddings and indexed in Pinecone:

A. Logical Partitioning:
Rather than mixing organization vectors in a single indices namespace, we partition embeddings using distinct namespace IDs (Organization ID). Every API query submitted to Pinecone is bound strictly to the current user's authenticated Organization ID.

B. Context Security:
Vector payloads stored in Pinecone do not contain references to user passwords or database encryption keys. They store text segment fragments and document references necessary for semantic scoring.

C. Metadata Filtering:
We apply strict metadata filters on vector queries at the database layer. This ensures that even in the event of an application logic error, vectors from one organization cannot leak into search queries from another.`,
  },
  {
    id: "authentication",
    title: "5. Auth & Role-Based Access Control",
    icon: UserCheck,
    content: `MeetOnMemory enforces a strict authorization model to govern platform access:

A. Authentication:
- Session Management: We utilize secure JSON Web Tokens (JWT) for API authorization. Session tokens are signed using a secure algorithm and stored with browser-safe flags to mitigate Cross-Site Scripting (XSS) and Session Hijacking.
- Passwords: We mandate complexity rules for user passwords to prevent brute-force attacks.

B. Role-Based Access Control (RBAC):
Inside every organization, users are partitioned into roles: Owner, Admin, and Member. 
- Creating meetings, uploading policies, and deleting records are restricted to Owners and Admins.
- Our backend REST APIs perform token-based role validation on every endpoint request before querying the MongoDB database, securing endpoints against horizontal privilege escalation.`,
  },
  {
    id: "network",
    title: "6. Network Firewalls & Protection",
    icon: Server,
    content: `Our server infrastructure is shielded by several layers of network security:

A. Web Application Firewall (WAF):
We utilize cloud security firewalls to inspect incoming HTTP requests, automatically filtering out common attack patterns, such as SQL Injection (SQLi), Cross-Site Scripting (XSS), and Remote File Inclusion (RFI).

B. DDoS Mitigation:
Our network routing is backed by cloud DDoS mitigation systems capable of absorbing and filtering out large-scale volumetric denial-of-service traffic before it reaches our backend nodes.

C. CORS Restrictions:
We enforce strict Cross-Origin Resource Sharing (CORS) lists on our API servers. Only requests originating from verified client domains are permitted to interact with our backend services.`,
  },
  {
    id: "incident",
    title: "7. Incident Response & Backups",
    icon: AlertOctagon,
    content: `We maintain procedures to protect against data loss and handle security incidents:

A. Automated Backups:
- We capture daily automated snapshots of our MongoDB database. Backups are stored in geographically isolated, encrypted storage buckets.
- We test backup restoration procedures monthly to guarantee a low Recovery Time Objective (RTO) and Recovery Point Objective (RPO).

B. Incident Response Plan:
In the event of a suspected security breach, our Incident Response Team initiates a containment workflow:
- Isolating affected database nodes and resetting API keys.
- Auditing connection logs to identify leaked credentials.
- In compliance with GDPR and CCPA requirements, we will notify affected administrators within 72 hours of confirming any unauthorized access to their organization's data.`,
  },
  {
    id: "subprocessors",
    title: "8. Sub-processors Directory",
    icon: Database,
    content: `MeetOnMemory works with trusted cloud infrastructure and service providers. Below is our directory of sub-processors:

- Amazon Web Services (AWS) / Google Cloud: Core hosting, secure server hosting, and encrypted media storage buckets. (US/Europe regions).
- MongoDB Atlas: Managed database hosting with built-in encryption at rest. (US regions).
- Pinecone: Secure vector database hosting for semantic search embeddings. (US regions).
- Google Gemini API: Large Language Model API processing for meeting summaries and report compilation. (US regions).
- Resend / SendGrid: Transactional email delivery for account activation and notifications. (Global).`,
  },
  {
    id: "regulations",
    title: "9. Regulatory Compliance",
    icon: Scale,
    content: `MeetOnMemory aligns with global privacy regulations:

A. GDPR Compliance:
We act as a Data Processor for the meeting records you upload. We provide tools inside the dashboard to support 'Right to be Forgotten' (deleting organization files purges database documents and vector nodes), Data Portability (exporting transcripts), and correction rights.

B. CCPA / CPRA:
We do not sell user data or meeting transcripts to third parties. We process data strictly to provide the features requested by our organizational subscribers.

C. SOC 2 Framework:
We structure our infrastructure settings, user log trails, deployment pipelines, and staff access reviews to align with SOC 2 Type II trust security principles.`,
  },
  {
    id: "vulnerability",
    title: "10. Vulnerability Disclosure",
    icon: Terminal,
    content: `We welcome reports from security researchers to help keep our platform safe.

Responsible Disclosure Guidelines:
- If you discover a security vulnerability in our application, API, or infrastructure, please report it privately to security@meetonmemory.com.
- Do not perform destructive actions, access other users' data without authorization, or disrupt services for our users.
- Provide detailed steps to reproduce the issue in your report.
- We commit to acknowledging receipt of your report within 48 hours and working to remediate verified high-severity vulnerabilities within 30 days.`,
  },
  {
    id: "auditLogs",
    title: "11. Audit Trails & Logs",
    icon: Activity,
    content: `Transparency is vital to security. We maintain logs of key events inside the application:

A. Administrative Logging:
We log administrative actions taken inside organizations, such as inviting new members, deleting meetings, changing organization settings, and modifying policy documents.

B. API Access Logs:
Our backend servers log HTTP request metadata (status codes, endpoint paths, hashed API keys) to monitor usage anomalies, detect brute-force login attempts, and audit database access patterns. 

C. Log Retention:
Audit logs are retained in write-once-read-many storage configurations for 90 days to support incident analysis, after which they are archived or securely deleted.`,
  },
  {
    id: "roadmap",
    title: "12. Compliance Roadmap",
    icon: Clock,
    content: `Our commitment to security is a continuous journey. We are working on the following milestones:

- SOC 2 Type II Auditing: Preparing for formal external auditing of our security operations.
- Single Sign-On (SSO): Developing native SAML and OIDC integrations to allow enterprise users to manage access via Okta, Azure AD, and Google Workspace.
- Advanced Role Customization: Introducing custom RBAC schemas to allow organizations to restrict access to vector queries at a file-level scale.
- ISO 27001 Alignment: Aligning our internal information security management systems with ISO standard frameworks.`,
  },
];

const Security = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("philosophy");
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Security Strength Calculator State
  const [calcSettings, setCalcSettings] = useState({
    mfa: true,
    sso: false,
    encryption: true,
    vectorIsolation: true,
    sessionTimeout: false,
  });
  const [showCalcTip, setShowCalcTip] = useState(false);

  // Calculate score dynamically
  const securityScore = useMemo(() => {
    let score = 0;
    if (calcSettings.mfa) score += 25;
    if (calcSettings.sso) score += 20;
    if (calcSettings.encryption) score += 20;
    if (calcSettings.vectorIsolation) score += 20;
    if (calcSettings.sessionTimeout) score += 15;
    return score;
  }, [calcSettings]);

  // Security Status Rating
  const securityRating = useMemo(() => {
    if (securityScore < 40) return { label: "Standard Protection", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200" };
    if (securityScore < 80) return { label: "Strong Guard", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200" };
    return { label: "Enterprise Hardened", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200" };
  }, [securityScore]);

  // References for scroll detection
  const sectionRefs = useRef({});

  // FAQ Accordion Data
  const faqs = [
    {
      q: "Are the meeting recordings stored securely?",
      a: "Yes. All uploaded media files (MP3, MP4, WAV, etc.) are written directly to private cloud storage buckets that enforce AES-256 encryption at rest. These buckets are configured with IAM permissions, ensuring that files can only be read by authorized server processes using temporary signed URLs.",
    },
    {
      q: "Can MeetOnMemory employees view my transcripts?",
      a: "No. MeetOnMemory employees do not have access to your private transcripts, summaries, or vector nodes. Databases are isolated in private subnets, and only authorized database administrators have key access for system troubleshooting, which requires senior approval and is audited.",
    },
    {
      q: "Does the search query send my entire database to the AI?",
      a: "No. Our Smart Search is a local semantic vector search. When you type a query, it is converted into a vector embedding. The database identifies the top matching chunks within your organization's partition. Only the relevant matched chunks are sent to the LLM to compile your answer, keeping the remaining documents completely private.",
    },
    {
      q: "What is your uptime SLA policy?",
      a: "We design our servers for 99.9% uptime. Our infrastructure is spread across multiple availability zones. Status alerts, database performance, and server responses are monitored continuously, and we publish incidents on our public status channels.",
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
            <Lock className="w-3.5 h-3.5 animate-pulse" /> Security Center
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
            Security & Compliance
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-gray-500 dark:text-slate-400">
            Understand how we secure your meeting records, transcription files, vector search indexes, and access parameters.
          </p>

          <div className="mt-8 max-w-md mx-auto relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search security topics, encryption, GDPR..."
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
              <Globe className="w-3.5 h-3.5" /> Compliance: GDPR / CCPA
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
                <Shield className="w-4 h-4 text-indigo-500" /> Security Outline
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
              <div className="bg-linear-to-tr from-indigo-600 to-blue-700 text-white rounded-xl p-4.5 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 bottom-0 translate-y-6 translate-x-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" /> Bug Bounty Program
                </h4>
                <p className="text-[11px] text-indigo-100 mt-2 leading-relaxed">
                  Report verified high-severity API or database vulnerabilities and participate in our responsible disclosure program.
                </p>
                <a
                  href="mailto:security@meetonmemory.com"
                  className="inline-block mt-3.5 bg-white text-indigo-700 font-semibold text-xs px-3.5 py-1.5 rounded-md hover:bg-indigo-50 transition"
                >
                  Submit Bug Report
                </a>
              </div>
            </div>
          </aside>

          {/* Right Column: Clauses and Calculator */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Interactive Security Strength Calculator */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Workspace Hardening Calculator
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Toggle parameters to simulate your organization's posture and review hardening suggestions.
                  </p>
                </div>
              </div>

              {/* Score display dial */}
              <div className="my-6 p-5 bg-gray-50/50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center justify-center">
                    {/* Visual radial score indicator */}
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="38"
                        stroke="#e2e8f0"
                        strokeWidth="8"
                        fill="transparent"
                        className="dark:stroke-slate-800"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="38"
                        stroke="#4f46e5"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={238}
                        strokeDashoffset={238 - (238 * securityScore) / 100}
                        className="transition-all duration-500 ease-out"
                      />
                    </svg>
                    <span className="absolute text-xl font-extrabold text-gray-950 dark:text-white">{securityScore}%</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 dark:text-slate-500 uppercase font-bold tracking-wider">Simulated Strength</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">Security Score</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Adjust settings below to hardening configurations.</p>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col items-center sm:items-start text-center sm:text-left ${securityRating.color} transition-all duration-300`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Status Rating</span>
                  <span className="font-extrabold text-sm sm:text-base mt-1 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 shrink-0" /> {securityRating.label}
                  </span>
                  <button
                    onClick={() => setShowCalcTip(!showCalcTip)}
                    className="mt-2.5 text-[10px] font-bold underline flex items-center gap-1 opacity-80 hover:opacity-100"
                  >
                    {showCalcTip ? "Hide Tip" : "Show Hardening Tip"}
                  </button>
                </div>
              </div>

              {showCalcTip && (
                <div className="mb-5 p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl text-xs text-indigo-800 dark:text-indigo-400 leading-relaxed animate-slide-down">
                  <h5 className="font-bold flex items-center gap-1.5 mb-1 text-indigo-900 dark:text-indigo-300">
                    <Info className="w-3.5 h-3.5" /> Recommendation:
                  </h5>
                  {securityScore < 60 ? (
                    "Enable SSO (SAML) and Strict Session Timeouts to shield administrator workspaces from external hijacking attempts."
                  ) : securityScore < 100 ? (
                    "To reach Enterprise status, check both Single Sign-On (SSO) and Strict Session timeouts, hardening access controls."
                  ) : (
                    "Your organization has selected full security capabilities. Your vectors partition, databases, and login routes are hardened."
                  )}
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-3.5">
                {/* Toggle 1 */}
                <label className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-800 rounded-xl hover:bg-gray-50/50 dark:hover:bg-slate-700/10 cursor-pointer select-none">
                  <div className="max-w-[80%] pr-3">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white">Multi-Factor Authentication (MFA)</h4>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Mandate email/authenticator verification codes on admin login attempts. (+25%)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcSettings.mfa}
                    onChange={(e) => setCalcSettings({ ...calcSettings, mfa: e.target.checked })}
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                {/* Toggle 2 */}
                <label className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-800 rounded-xl hover:bg-gray-50/50 dark:hover:bg-slate-700/10 cursor-pointer select-none">
                  <div className="max-w-[80%] pr-3">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white">SAML Single Sign-On (SSO)</h4>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Integrate user access through centralized directories (Okta, Google Workspace). (+20%)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcSettings.sso}
                    onChange={(e) => setCalcSettings({ ...calcSettings, sso: e.target.checked })}
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                {/* Toggle 3 */}
                <label className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-800 rounded-xl hover:bg-gray-50/50 dark:hover:bg-slate-700/10 cursor-pointer select-none">
                  <div className="max-w-[80%] pr-3">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white">Media Encryption At-Rest (AES-256)</h4>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Encrypt raw meeting audio files before writing to cloud storage buckets. (+20%)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcSettings.encryption}
                    onChange={(e) => setCalcSettings({ ...calcSettings, encryption: e.target.checked })}
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                {/* Toggle 4 */}
                <label className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-800 rounded-xl hover:bg-gray-50/50 dark:hover:bg-slate-700/10 cursor-pointer select-none">
                  <div className="max-w-[80%] pr-3">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white">Pinecone Vector Index Isolation</h4>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Isolate organizational search metadata in distinct database partitions. (+20%)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcSettings.vectorIsolation}
                    onChange={(e) => setCalcSettings({ ...calcSettings, vectorIsolation: e.target.checked })}
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                {/* Toggle 5 */}
                <label className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-800 rounded-xl hover:bg-gray-50/50 dark:hover:bg-slate-700/10 cursor-pointer select-none">
                  <div className="max-w-[80%] pr-3">
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white">Strict Session Invalidation</h4>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Enforce automatic token timeouts after 15 minutes of user inactivity. (+15%)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={calcSettings.sessionTimeout}
                    onChange={(e) => setCalcSettings({ ...calcSettings, sessionTimeout: e.target.checked })}
                    className="h-4.5 w-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>
              </div>
            </section>
            
            {/* Search warning banner */}
            {searchQuery && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Search Filter Active</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Showing topics that match "{searchQuery}". Clear query to view the full security blueprint.
                  </p>
                </div>
              </div>
            )}

            {/* Document Content List */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-10">
              {filteredSections.length === 0 ? (
                <div className="text-center py-12">
                  <AlertOctagon className="w-12 h-12 text-amber-500 mx-auto mb-3 animate-bounce" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">No matches found</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                    Try searching for different terms like 'encryption', 'Pinecone', 'DDoS', or 'WAF'.
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

            {/* FAQs Accordion */}
            <section className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Security FAQs
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Quick clarifications regarding vector caches, SLA, and staff databases access.
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

            {/* Revision Timeline */}
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
                    Timeline details showing audits and security standard upgrades.
                  </p>
                </div>
              </div>

              <div className="relative pl-6 border-l-2 border-indigo-100 dark:border-indigo-950/80 space-y-6">
                {/* Node 1 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-500 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.2
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">July 16, 2026 (Current)</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Added namespaces partitioning scopes for Pinecone searches and clarified TLS 1.3 and sub-processors details.
                  </p>
                </div>

                {/* Node 2 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.1
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">March 04, 2026</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Incorporated daily snapshot backup restoration validation tests and configured WAF shielding guidelines.
                  </p>
                </div>

                {/* Node 3 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800" />
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2.5">
                    Version 1.0
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">November 10, 2025</span>
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-normal">
                    Initial launch documenting bcrypt credentials hashing and JSON Web Tokens session validations.
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
              href="mailto:security@meetonmemory.com"
              className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
            >
              Contact Security Desk
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

export default Security;
