import React, { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  Search,
  BookOpen,
  HelpCircle,
  MessageSquare,
  FileText,
  Video,
  Settings,
  Shield,
  Zap,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Mail,
  FileQuestion,
  Sparkles,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openFaqId, setOpenFaqId] = useState(null);
  
  // Article ratings state
  const [ratings, setRatings] = useState({});
  const [submittedRatingId, setSubmittedRatingId] = useState(null);

  // References for scrolling
  const topRef = useRef(null);

  const categories = [
    { id: "all", name: "All Topics", icon: FileQuestion },
    { id: "getting-started", name: "Getting Started", icon: BookOpen },
    { id: "transcription", name: "Transcription & Media", icon: Video },
    { id: "ai-summaries", name: "AI Summaries", icon: Sparkles },
    { id: "workspace-settings", name: "Workspace & Team", icon: Settings },
    { id: "security-privacy", name: "Security & Privacy", icon: Shield },
  ];

  const articles = useMemo(() => [
    {
      id: "create-account",
      category: "getting-started",
      title: "How to create your MeetOnMemory account",
      content: `Getting started with MeetOnMemory is quick and simple. To create an account:
      
      1. Navigate to the MeetOnMemory homepage and click the "Get Started" or "Sign Up" button.
      2. Enter your Full Name, email address, and choose a strong, unique password.
      3. Alternatively, click the Google OAuth integration icon to sign in instantly with your Google Workspace profile.
      4. Once you submit the registration form, you will receive an activation email with a verification link. Click the link in the email to authenticate your account and access your dashboard.
      
      If you do not receive the verification code within 3 minutes, please check your spam folder or click "Resend Verification Code" on the verification screen.`,
      tags: ["signup", "registration", "verification", "login"],
    },
    {
      id: "create-org",
      category: "getting-started",
      title: "Creating and setting up an Organization Workspace",
      content: `Organizations are private, multi-tenant boundaries that isolate all your meeting records, transcription templates, and semantic knowledge stores.
      
      To create a new organization:
      1. Head to your Dashboard and look for the organization switcher dropdown in the top navigation panel.
      2. Click "Create New Organization".
      3. Choose a unique name and customize the organization URL slug (e.g., meetonmemory.com/organizations/your-company).
      4. Configure default workspace settings, such as member invitation permissions and custom transcription presets.
      5. Click "Initialize Organization".
      
      Once initialized, you can begin adding members, setting up collaborative meeting rooms, and configuring custom integration endpoints.`,
      tags: ["organization", "tenant", "workspace", "setup"],
    },
    {
      id: "media-requirements",
      category: "transcription",
      title: "Supported media files and upload limits",
      content: `MeetOnMemory supports a wide range of audio and video formats to ensure compatibility with your preferred communication tools:
      
      Supported Audio Formats:
      - MP3 (MPEG Audio Layer III)
      - WAV (Waveform Audio File Format)
      - M4A (MPEG-4 Audio)
      - AAC, FLAC, and OGG.
      
      Supported Video Formats:
      - MP4 (MPEG-4 Part 14)
      - WEBM (HTML5 Video container)
      - MOV (QuickTime Movie)
      
      File Upload Size Limits:
      - Free Tier: Up to 50 MB per file, max 2 hours of transcriptions per month.
      - Pro Tier: Up to 500 MB per file, max 20 hours of transcriptions per month.
      - Enterprise: Up to 2 GB per file, unlimited transcription processing.`,
      tags: ["audio", "video", "uploads", "size", "mp4", "mp3"],
    },
    {
      id: "improve-accuracy",
      category: "transcription",
      title: "How to improve transcription accuracy",
      content: `Our AI-powered speech-to-text engines deliver up to 98% accuracy. To maximize the clarity and precision of your meeting transcriptions, follow these best practices:
      
      - Clear Audio Capture: Encourage meeting participants to use high-quality external microphones or headsets instead of default laptop microphones.
      - Reduce Background Noise: Minimize background hum, air conditioning noise, and keyboard click disruptions.
      - Custom Vocabulary: Add organization-specific terms, product names, industry jargon, and team acronyms in the "Workspace Vocabulary Settings" panel. Our speech-to-text pipeline integrates these inputs to prevent phonetic misinterpretations.
      - Speaker Separation: When recording physical meeting rooms, place a multi-directional boundary microphone in the center of the table to assist our speaker diarization algorithm in separating different voices.`,
      tags: ["accuracy", "mic", "noise", "languages", "diarization"],
    },
    {
      id: "custom-summaries",
      category: "ai-summaries",
      title: "Understanding and editing AI Summaries (MoM)",
      content: `Once a meeting transcription is finalized, our Google Gemini model parses the text segments to automatically generate structured Minutes of Meeting (MoM).
      
      The summary breakdown features:
      - Summary Overview: A concise narrative of the meeting context and key takeaways.
      - Action Items: A list of tasks assigned to specific participants with deadlines.
      - Decision Logs: Highlights key strategic determinations agreed upon by the organization members.
      - Topic Breakdown: A categorized timeline of discussions.
      
      Editing Summaries:
      If you need to tweak the generated content, open the meeting page, select the "Summary" tab, and click "Edit Summary". You can modify text boxes directly or prompt our AI assistant to re-write specific bullet points.`,
      tags: ["mom", "summaries", "gemini", "action items", "edit"],
    },
    {
      id: "semantic-search",
      category: "ai-summaries",
      title: "How does AI Semantic Search work?",
      content: `MeetOnMemory's semantic search feature allows you to query your entire organization's repository using natural language sentences instead of exact word matches.
      
      How it works:
      1. We divide your transcripts and policy documents into small, logical paragraphs.
      2. Each paragraph is vectorized using our advanced embedding pipeline, converting text into mathematical coordinates representing its contextual meaning.
      3. These embeddings are stored securely in our Pinecone database, separated by your Organization ID.
      4. When you enter a query (e.g., "What was our discussion on Q3 server migration?"), our search engine computes the vector similarity and serves the exact segments matching your context, even if the words 'Q3' or 'migration' are not exactly in the text.`,
      tags: ["search", "semantic", "pinecone", "vector", "query"],
    },
    {
      id: "manage-members",
      category: "workspace-settings",
      title: "Inviting team members and managing roles",
      content: `Workspaces are collaborative. You can invite your team and set up Role-Based Access Control (RBAC) to restrict viewing permissions:
      
      Inviting Members:
      1. Go to "Organization Settings" > "Team Members".
      2. Click "Invite Member" and input their email addresses.
      3. Choose an initial role for the invitation link.
      
      Role Descriptions:
      - Admin: Full control over billing, deleting organization transcripts, integrating bots, and managing permissions.
      - Member: Can upload recordings, view all organization transcripts, run semantic searches, and edit summaries.
      - Guest / Client: Read-only access to specific shared meetings and summaries. Cannot browse the organization workspace policies or list other members.`,
      tags: ["invite", "members", "roles", "admin", "rbac"],
    },
    {
      id: "slack-integration",
      category: "workspace-settings",
      title: "Connecting and using the Slack Bot",
      content: `Our Slack bot allows you to receive instant meeting summaries and query transcripts directly inside your workspace channels.
      
      To authorize Slack:
      1. Click "Settings" > "Integrations" from the dashboard side navigation.
      2. Find the Slack integration panel and click "Add to Slack".
      3. Select the Slack workspace you want to connect and authorize permissions.
      
      Using the Slack Bot:
      - Transcribe Alerts: Get instant summary notifications when a new meeting is processed.
      - /ask-mom: Type '/ask-mom [your question]' in any connected channel to trigger a secure semantic search against your organization's vector indexes and get an AI-summarized response.`,
      tags: ["slack", "bot", "integrations", "ask-mom", "alerts"],
    },
    {
      id: "gdpr-compliance",
      category: "security-privacy",
      title: "GDPR, CCPA, and data privacy workflows",
      content: `We build security and compliance into every layer of our platform. Under international privacy laws (GDPR, CCPA, ePrivacy), you possess multiple data sovereignty rights:
      
      - Right to Erasure (Right to be Forgotten): Admins can permanently delete transcripts, audio files, and user records. When deleted, we immediately purge the data from our live MongoDB collections, Pinecone index partitions, and delete matching backups within 14 days.
      - Right to Portability: Users can export their entire transcript and audit trail history in JSON or PDF formats at any time.
      - Isolation Guarantee: Your data is never used to train global public AI models. All API requests are processed through private enterprise pipelines.`,
      tags: ["gdpr", "ccpa", "privacy", "delete", "export", "encryption"],
    },
    {
      id: "data-encryption",
      category: "security-privacy",
      title: "Security protocols and data encryption standards",
      content: `MeetOnMemory secures your organization's intellectual property using industry-standard cryptography:
      
      - Encryption in Transit: All interactions with our API servers are encrypted using TLS 1.3 with strong cipher suites.
      - Encryption at Rest: Core database files, configuration secrets, and vector embedding pipelines are encrypted at rest using AES-256 keys.
      - Multi-Tenant Isolation: Tenant segregation is checked and enforced at the database query level to prevent horizontal unauthorized access between organization scopes.
      - Regular Security Audits: We run weekly automated vulnerability sweeps and static code analysis checks across our repository.`,
      tags: ["encryption", "aes-256", "tls", "security", "tenant", "audit"],
    },
  ], []);

  // Handle article rating
  const handleRateArticle = (id, rating) => {
    setRatings((prev) => ({
      ...prev,
      [id]: rating,
    }));
    setSubmittedRatingId(id);
    setTimeout(() => {
      setSubmittedRatingId(null);
    }, 3000);
  };

  // Filter articles by category and search query
  const filteredArticles = useMemo(() => {
    let result = articles;
    
    if (selectedCategory !== "all") {
      result = result.filter((art) => art.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (art) =>
          art.title.toLowerCase().includes(query) ||
          art.content.toLowerCase().includes(query) ||
          art.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [searchQuery, selectedCategory, articles]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 flex flex-col" ref={topRef}>
      <Navbar />

      {/* Hero Search Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-blue-600 via-indigo-700 to-violet-800 text-white pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute top-1/4 left-1/10 w-96 h-96 rounded-full bg-white/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/10 w-96 h-96 rounded-full bg-blue-400/30 blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/25 text-xs font-semibold uppercase tracking-wider mb-5">
            <Zap className="w-3.5 h-3.5 text-amber-300" /> MeetOnMemory Support
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            How can we help you today?
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-blue-100/90 leading-relaxed">
            Search our knowledge base for guides on transcription, semantic searches, team settings, and workspace security options.
          </p>

          {/* Interactive Search Bar */}
          <div className="mt-8 max-w-xl mx-auto relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5.5 w-5.5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search guides, answers, integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-12 pr-4 py-4 border-0 rounded-2xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/50 shadow-lg text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-gray-400 hover:text-gray-600 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex-1">
        
        {/* Category Pill Filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 pb-4 border-b border-gray-200/50 dark:border-slate-800">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setOpenFaqId(null);
                }}
                className={`flex items-center gap-2 px-4.5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-slate-700/60 hover:bg-gray-50 dark:hover:bg-slate-750"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Grid for Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Filter & Fast Stats */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <h3 className="text-xs font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-500" /> Help Quick Links
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/privacy"
                    className="flex items-center justify-between p-2.5 text-sm font-semibold text-gray-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/40 transition"
                  >
                    <span>Privacy Policy Guidelines</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="flex items-center justify-between p-2.5 text-sm font-semibold text-gray-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/40 transition"
                  >
                    <span>Terms of Service Agreement</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/security"
                    className="flex items-center justify-between p-2.5 text-sm font-semibold text-gray-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/40 transition"
                  >
                    <span>Security Audits & Policies</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cookie-policy"
                    className="flex items-center justify-between p-2.5 text-sm font-semibold text-gray-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/40 transition"
                  >
                    <span>Cookie & Browser Cache Console</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Quick Contact Card */}
            <div className="bg-linear-to-tr from-indigo-600 to-violet-700 text-white rounded-2xl p-6 shadow-xs relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-y-8 translate-x-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
              <h4 className="font-bold text-base flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-200" /> Still stuck?
              </h4>
              <p className="text-xs text-indigo-100 mt-2.5 leading-relaxed">
                Can't find the answers you're looking for? Raise a ticket or connect with our customer success team directly.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-1.5 mt-4 bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs px-4 py-2.5 rounded-xl transition"
              >
                Open Help Ticket <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </aside>

          {/* Right Panel: Articles Accordion list */}
          <div className="lg:col-span-8 space-y-6">
            
            {searchQuery && (
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                Found {filteredArticles.length} guides matching "{searchQuery}"
              </div>
            )}

            <div className="space-y-4">
              {filteredArticles.length === 0 ? (
                <div className="text-center bg-white dark:bg-slate-800 rounded-2xl py-16 px-4 border border-gray-100 dark:border-slate-800">
                  <FileQuestion className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">No guides match your search</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                    Try searching for common terms like 'invite', 'encryption', 'WAV', or 'slack' to locate the correct articles.
                  </p>
                </div>
              ) : (
                filteredArticles.map((art) => {
                  const isOpen = openFaqId === art.id;
                  const isRated = ratings[art.id] !== undefined;
                  const showSuccessToast = submittedRatingId === art.id;

                  return (
                    <div
                      key={art.id}
                      className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition"
                    >
                      <button
                        onClick={() => setOpenFaqId(isOpen ? null : art.id)}
                        className="w-full flex items-center justify-between p-5 bg-gray-50/50 dark:bg-slate-700/10 hover:bg-gray-50 dark:hover:bg-slate-700/30 text-left transition duration-200"
                      >
                        <div>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
                            {art.category.replace("-", " ")}
                          </span>
                          <span className="font-bold text-sm sm:text-base text-gray-900 dark:text-white block">
                            {art.title}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform duration-250 shrink-0 ml-4 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="p-6 border-t border-gray-100 dark:border-slate-750 bg-white dark:bg-slate-800 space-y-5">
                          <div className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {art.content}
                          </div>

                          {/* Tag chips */}
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {art.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-sm"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>

                          {/* Helpful Rating widget */}
                          <div className="p-4 bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-850 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
                            <span className="text-gray-500 dark:text-slate-400 font-medium">
                              Was this guide helpful?
                            </span>
                            
                            {isRated ? (
                              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                Thanks for your feedback!
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRateArticle(art.id, "yes")}
                                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" /> Yes
                                </button>
                                <button
                                  onClick={() => handleRateArticle(art.id, "no")}
                                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5 text-rose-500" /> No
                                </button>
                              </div>
                            )}
                          </div>

                          {showSuccessToast && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">
                              Your rating helps us improve this guide!
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </main>

      {/* Support center direct link */}
      <footer className="bg-gray-100 dark:bg-slate-950 border-t border-gray-200/80 dark:border-slate-800/80 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
          <div className="p-3 bg-blue-100/50 dark:bg-blue-950/40 rounded-full inline-flex text-blue-600 dark:text-blue-400">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            Can't find what you need?
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
            Our specialized support team is available 24/7 to resolve transcription anomalies, billing queries, and security configurations.
          </p>
          <div className="pt-2">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-500/20 hover:scale-103 active:scale-100 transition duration-200"
            >
              Contact Support Team <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HelpCenter;

