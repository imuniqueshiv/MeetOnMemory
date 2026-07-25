import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import {
  Briefcase,
  MapPin,
  Users,
  CheckCircle2,
  ArrowRight,
  Search,
  Building,
  Clock,
  Heart,
  Sparkles,
  DollarSign,
  GraduationCap,
  X,
  ChevronDown,
  ChevronUp,
  Award,
  Coffee,
  Globe,
  HelpCircle,
} from "lucide-react";

// Curated Mock Job Listings
const initialJobs = [
  {
    id: "sr-frontend",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "Remote (US/Europe)",
    type: "Full-time",
    experience: "5+ Years",
    tag: "Senior",
    salary: "$130k - $160k",
    description: "Join us in crafting the frontend architecture for our real-time meeting transcription and visual workspace dashboards. You will work closely with Gemini API integrations and leverage high-performance React patterns.",
    requirements: [
      "Expertise in modern React (Hooks, Context, performance optimization)",
      "Strong understanding of TailwindCSS, CSS variables, and fluid layouts",
      "Experience with WebSockets and real-time state synchronization",
      "Familiarity with visual graph libraries (e.g., D3, cytoscape) is a plus",
    ],
  },
  {
    id: "ai-engineer",
    title: "AI / NLP Research Engineer",
    department: "Engineering",
    location: "Hybrid (San Francisco, CA)",
    type: "Full-time",
    experience: "3+ Years",
    tag: "Mid-Senior",
    salary: "$150k - $180k + Equity",
    description: "Design and implement custom embedding models and Gemini-driven consolidation pipelines. You will lead semantic database designs (Pinecone) and solve challenges around long-context window retrieval.",
    requirements: [
      "Strong background in NLP, LLMs, and vector embeddings",
      "Proficient in Python and Node.js backend integration",
      "Experience deploying models at scale or fine-tuning open source models",
      "Degree in CS, AI, or equivalent quantitative research experience",
    ],
  },
  {
    id: "product-designer",
    title: "Product Designer (UI/UX)",
    department: "Product & Design",
    location: "Remote (Global)",
    type: "Full-time",
    experience: "4+ Years",
    tag: "Mid-Senior",
    salary: "$110k - $140k",
    description: "Lead design initiatives from concept to production. You will craft interfaces that render semantic relationship maps, custom editor tools, and onboarding directories.",
    requirements: [
      "Stunning portfolio demonstrating clean, premium visual design and prototyping",
      "Expert-level knowledge of Figma and component library systems",
      "Ability to write React/HTML/CSS prototypes is highly valued",
      "User-centric mindset with experience in B2B SaaS/collaboration products",
    ],
  },
  {
    id: "marketing-manager",
    title: "Product Marketing Manager",
    department: "Growth & Marketing",
    location: "Hybrid (New York, NY)",
    type: "Full-time",
    experience: "3+ Years",
    tag: "Mid",
    salary: "$90k - $120k",
    description: "Position MeetOnMemory as the market leader in meeting productivity. You will create multi-channel campaigns, draft case studies, and coordinate product launch pipelines.",
    requirements: [
      "Proven track record in B2B product marketing or developer relations",
      "Outstanding storytelling and content creation capabilities",
      "Experience analyzing campaign data and running search/social ad budgets",
    ],
  },
  {
    id: "intern-gemini",
    title: "Software Engineer Intern (Gemini Integrations)",
    department: "Engineering",
    location: "Remote",
    type: "Internship",
    experience: "Student / Graduate",
    tag: "Internship",
    salary: "Paid Stipend",
    description: "Work directly on prototype tools connecting user transcription logs to Google Gemini models. You will receive 1-on-1 mentorship from senior software staff.",
    requirements: [
      "Currently enrolled in or recently graduated from a CS or related degree",
      "Solid knowledge of JavaScript, ES6+, and React basics",
      "Curious about generative AI, system architecture, and prompt engineering",
    ],
  },
  {
    id: "grad-pm",
    title: "Graduate Product Manager",
    department: "Product & Design",
    location: "Hybrid (New York, NY)",
    type: "Graduate Program",
    experience: "New Graduate",
    tag: "Graduate Program",
    salary: "$80k - $95k",
    description: "Kickstart your product management journey by co-leading key features such as Slack integration dashboards, scheduling controllers, and translation pipelines.",
    requirements: [
      "Recent graduate with a degree in CS, Business, Design, or equivalent field",
      "Demonstrated leadership capabilities in university projects or startups",
      "Outstanding communication skills and analytical mindset",
    ],
  },
];

// Culture & Values Data
const cultureValues = [
  {
    title: "Pioneering Innovation",
    desc: "We push the envelope of LLM integration, going beyond chat boxes to model structured organizational memory.",
    icon: Sparkles,
  },
  {
    title: "Radical Ownership",
    desc: "We trust you to build things your way. There is no micro-management; just metrics, goals, and support.",
    icon: Award,
  },
  {
    title: "Global Diversity",
    desc: "We are a remote-first, globally distributed team of builders who value diverse viewpoints and collaborative growth.",
    icon: Globe,
  },
  {
    title: "Empathetic Inclusion",
    desc: "Collaboration is our foundation. We celebrate each other's successes and build psychological safety together.",
    icon: Users,
  },
];

// Timeline Hiring Process Data
const hiringSteps = [
  {
    step: "01",
    title: "Application Review",
    desc: "Our recruiting team reviews your application, resume, and portfolio link within 3 business days.",
  },
  {
    step: "02",
    title: "Initial Chat",
    desc: "A brief 30-minute call to align on your career goals, values, and role context.",
  },
  {
    step: "03",
    title: "Technical / Creative Deep-Dive",
    desc: "A collaborative session with our engineering or design team to solve real-world problems. No abstract brainteasers.",
  },
  {
    step: "04",
    title: "Final Interview & Offer",
    desc: "Meet our leadership team to talk product direction, and walk through our customized offer package.",
  },
];

// Employee Benefits Data
const benefitsData = [
  {
    title: "Remote First & Flexible Hours",
    desc: "Work from anywhere in the world. We offer workspaces stipends and core alignment hours.",
    icon: Globe,
  },
  {
    title: "Top Health, Dental, Vision",
    desc: "Comprehensive premium insurance coverage options for you and your dependents.",
    icon: Heart,
  },
  {
    title: "Competitive Pay & Equity",
    desc: "Fair compensation packages matching market leaders, paired with active stock options.",
    icon: DollarSign,
  },
  {
    title: "Learning & Growth Stipend",
    desc: "$2,000 yearly allowance for courses, conferences, certifications, and textbooks.",
    icon: GraduationCap,
  },
  {
    title: "Workspace Equipment",
    desc: "We provide your choice of computer, monitor, office accessories, and ergonomic support.",
    icon: LaptopIcon,
  },
  {
    title: "Rest & Wellness Days",
    desc: "Generous PTO, paid parental leaves, and dedicated quarterly team mental-health days.",
    icon: Coffee,
  },
];

// Helper mock icon since Laptop might not exist in standard Lucide
function LaptopIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="12" x="3" y="4" rx="2" ry="2" />
      <line x1="2" x2="22" y1="20" y2="20" />
      <line x1="5" x2="19" y1="16" y2="16" />
    </svg>
  );
}

// FAQs Data
const faqData = [
  {
    q: "Can I apply for multiple roles at once?",
    a: "Yes! If you find more than one role that fits your experience and skillset, you are welcome to apply to both. Our hiring managers will review them and direct you to the best fit.",
  },
  {
    q: "Do you offer visa sponsorships?",
    a: "We support visa sponsorship and transfers for key senior and technical roles depending on locations. For remote roles, we support direct contracts via local compliance platforms (e.g. Deel).",
  },
  {
    q: "What is your onboarding process like?",
    a: "Onboarding lasts 2 weeks. You will pair with a mentor, set up your workspace environment, learn our codebase conventions, and push your first small production feature within your first 3 days.",
  },
  {
    q: "How does the internship program differ?",
    a: "Our internships (typically 12-16 weeks) are fully integrated into active sprint teams. You will work on real user features, participate in reviews, and be evaluated for full-time graduate offers.",
  },
];

const Careers = () => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedLoc, setSelectedLoc] = useState("All");
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);

  // Application Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeJobForModal, setActiveJobForModal] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    portfolio: "",
    resume: "",
    coverLetter: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic filter collections
  const departments = useMemo(() => {
    const set = new Set(initialJobs.map((j) => j.department));
    return ["All", ...Array.from(set)];
  }, []);

  const locations = useMemo(() => {
    const list = ["All", "Remote", "Hybrid", "San Francisco", "New York"];
    return list;
  }, []);

  const filteredJobs = useMemo(() => {
    return initialJobs.filter((job) => {
      const matchSearch =
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchDept = selectedDept === "All" || job.department === selectedDept;
      
      const matchLoc =
        selectedLoc === "All" ||
        job.location.toLowerCase().includes(selectedLoc.toLowerCase());

      return matchSearch && matchDept && matchLoc;
    });
  }, [searchQuery, selectedDept, selectedLoc]);

  // Expand job overview accordion
  const toggleJob = (id) => {
    setExpandedJob(expandedJob === id ? null : id);
  };

  // Expand FAQ accordion
  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  // Open modal
  const openApplication = (job) => {
    setActiveJobForModal(job);
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setActiveJobForModal(null);
    setFormData({
      name: "",
      email: "",
      portfolio: "",
      resume: "",
      coverLetter: "",
    });
  };

  // Handle Form Change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Submit application
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.resume) {
      toast.error("Please fill in all required fields (Name, Email, Resume).");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("✨ Application submitted successfully! We will contact you soon.");
      closeModal();
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300 flex flex-col font-sans select-none">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800 bg-linear-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950/20 pt-32 pb-16 px-4">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-blue-100/50 dark:bg-blue-900/10 blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-violet-100/30 dark:bg-violet-900/5 blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Briefcase className="w-4 h-4" /> Work With Us
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
            Shape the Future of Meeting Intelligence
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base mb-8">
            Help us build semantic graphs and generative memories to keep global teams aligned. Explore internships, graduate roles, and senior opportunities.
          </p>

          {/* Interactive Search & Filter Controls */}
          <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900/80 rounded-3xl p-4 shadow-lg border border-slate-200/80 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search job title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none"
              />
            </div>

            {/* Department Dropdown */}
            <div className="relative flex items-center border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 px-3 py-1.5 md:py-0">
              <Building className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-transparent border-none text-slate-700 dark:text-slate-300 text-sm focus:outline-none cursor-pointer appearance-none pr-8"
              >
                <option value="All" className="dark:bg-slate-900">All Departments</option>
                {departments.filter(d => d !== "All").map(dept => (
                  <option key={dept} value={dept} className="dark:bg-slate-900">{dept}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
            </div>

            {/* Location Dropdown */}
            <div className="relative flex items-center border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 px-3 py-1.5 md:py-0">
              <MapPin className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
              <select
                value={selectedLoc}
                onChange={(e) => setSelectedLoc(e.target.value)}
                className="w-full bg-transparent border-none text-slate-700 dark:text-slate-300 text-sm focus:outline-none cursor-pointer appearance-none pr-8"
              >
                {locations.map(loc => (
                  <option key={loc} value={loc} className="dark:bg-slate-900">
                    {loc === "All" ? "All Locations" : loc}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Our Culture & Values</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto text-sm">
            We are built on trust, innovation, and psychological safety. Here is what we care about.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cultureValues.map((val, idx) => {
            const Icon = val.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:shadow-md transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{val.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{val.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Open Positions Section */}
      <section className="bg-slate-50/50 dark:bg-slate-900/10 border-y border-slate-200/60 dark:border-slate-800/60 py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Explore Opportunities</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                Browse our open positions and select a role to view details and apply.
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold bg-slate-200/60 dark:bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-300/40 dark:border-slate-700/50">
              {filteredJobs.length} Positions Open
            </span>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                No matching opportunities found
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Try modifying your department or location filters, or check back soon for updates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job) => {
                const isOpen = expandedJob === job.id;
                const isSpecial = job.type === "Internship" || job.type === "Graduate Program";
                return (
                  <div
                    key={job.id}
                    className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300"
                  >
                    {/* Header Card */}
                    <div
                      onClick={() => toggleJob(job.id)}
                      className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {job.title}
                          </h3>
                          {isSpecial ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200/50 dark:border-violet-800/30">
                              {job.type}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30">
                              {job.type}
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400 text-sm font-medium">
                          <span className="flex items-center gap-1">
                            <Building className="w-3.5 h-3.5" />
                            {job.department}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {job.location}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {job.experience}
                          </span>
                        </div>
                      </div>

                      {/* Right button indicator */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                          {job.salary}
                        </span>
                        <div className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-colors">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Panel */}
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isOpen ? "max-h-[800px] border-t border-slate-100 dark:border-slate-800/60" : "max-h-0"
                      }`}
                    >
                      <div className="p-6 bg-slate-50/30 dark:bg-slate-800/10 space-y-6">
                        <div>
                          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Role Description</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                            {job.description}
                          </p>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Key Requirements</h4>
                          <ul className="space-y-2">
                            {job.requirements.map((req, ridx) => (
                              <li key={ridx} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                                <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Action apply */}
                        <div className="pt-4 flex items-center justify-end">
                          <button
                            onClick={() => openApplication(job)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
                          >
                            Apply for this Position
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Timeline Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Our Hiring Process</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto text-sm">
            Here is a look at what you can expect after you submit your application.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          {/* Connector Line (visible on desktop) */}
          <div className="hidden md:block absolute top-[44px] left-[10%] right-[10%] h-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />

          {hiringSteps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center md:items-start text-center md:text-left space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm relative font-extrabold text-blue-600 dark:text-blue-400 text-lg">
                {step.step}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Employee Benefits Section */}
      <section className="bg-slate-50/50 dark:bg-slate-900/10 border-t border-slate-200/60 dark:border-slate-800/60 py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Benefits & Perks</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto text-sm">
              We care about your well-being, growth, and workflow. Here is how we support you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefitsData.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div key={idx} className="flex gap-4 items-start bg-white dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{benefit.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="max-w-4xl mx-auto px-4 py-20 w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Everything you need to know about applying and working at MeetOnMemory.
          </p>
        </div>

        <div className="space-y-3">
          {faqData.map((faq, index) => {
            const isOpen = expandedFaq === index;
            return (
              <div
                key={index}
                className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800/60 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left font-semibold text-slate-900 dark:text-white hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
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
                    isOpen ? "max-h-60 border-t border-slate-100 dark:border-slate-800/60" : "max-h-0"
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
      </section>

      {/* General Application CTA Card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 w-full">
        <div className="bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-slate-900/50 dark:to-slate-800/50 rounded-3xl border border-indigo-100/50 dark:border-slate-800 p-8 sm:p-12 text-center shadow-md relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-2xl" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg mb-6">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
              Don't see your matching role?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mb-8 max-w-md mx-auto">
              We are always on the lookout for talented engineers, designers, and innovators. Drop us an open application.
            </p>
            <button
              onClick={() => openApplication({ title: "General Application", id: "general", department: "Any", location: "Remote" })}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              Submit Open Application
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Application Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Close */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="mb-6">
              <span className="text-[10px] font-extrabold tracking-wider text-blue-600 dark:text-blue-400 uppercase bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/30 px-2 py-0.5 rounded-md">
                Application Form
              </span>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
                Apply for {activeJobForModal?.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Fill out the details below to submit your profile for consideration.
              </p>
            </div>

            {/* Application Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {/* Portfolio Link */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Portfolio / GitHub Link
                </label>
                <input
                  type="url"
                  name="portfolio"
                  value={formData.portfolio}
                  onChange={handleChange}
                  placeholder="https://github.com/johndoe"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {/* Resume Link */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Resume Link (PDF/Drive) <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  name="resume"
                  required
                  value={formData.resume}
                  onChange={handleChange}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {/* Cover Letter */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Briefly introduce yourself
                </label>
                <textarea
                  name="coverLetter"
                  rows="3"
                  value={formData.coverLetter}
                  onChange={handleChange}
                  placeholder="Why do you want to join MeetOnMemory?"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Careers;
