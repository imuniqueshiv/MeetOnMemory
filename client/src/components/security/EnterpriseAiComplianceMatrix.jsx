import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  Lock,
  Cpu,
  Database,
  Eye,
  FileSpreadsheet,
  X,
  ExternalLink,
  Shield,
  Layers,
  Key,
  Activity,
  UserCheck,
  RefreshCw,
  Info,
  CheckCircle2,
  FileCode,
} from "lucide-react";

// Compliance Matrix Master Data
const MATRIX_CONTROLS = [
  {
    id: "SEC-AI-01",
    category: "Zero Retention",
    title: "In-Memory LLM Processing & Zero Log Retention",
    description:
      "All audio transcription and summary prompts sent to LLM endpoints operate statelessly in-memory. Provider-side persistent logging and caching are strictly disabled.",
    enforcement:
      "Enterprise Developer API Agreement with Google Gemini & OpenAI",
    frameworks: [
      { name: "SOC 2", ref: "CC6.1, CC6.6" },
      { name: "GDPR", ref: "Art. 28" },
      { name: "ISO 27001", ref: "A.12.1" },
    ],
    status: "Enforced",
    auditProof: {
      type: "Contractual & API Header",
      verificationCmd:
        "grep -rn 'zeroDataRetention' server/services/GenerativeAIService.js",
      evidence:
        "All requests set zero-data-retention headers and route through enterprise API endpoints guaranteed under signed DPA agreements.",
    },
  },
  {
    id: "SEC-AI-02",
    category: "Model Isolation",
    title: "Explicit Model Training & Fine-Tuning Opt-Out",
    description:
      "Customer transcripts, structured MoM outputs, action items, and voice embeddings are explicitly excluded from model training or global LLM baseline updates.",
    enforcement: "Contractual Zero-Training Clause & Opt-Out Headers",
    frameworks: [
      { name: "SOC 2", ref: "CC6.1" },
      { name: "GDPR", ref: "Art. 5" },
      { name: "HIPAA", ref: "§ 164.502" },
      { name: "CCPA", ref: "Non-Sale Clause" },
    ],
    status: "Enforced",
    auditProof: {
      type: "Policy & Endpoint Protocol",
      verificationCmd: "cat docs/security-and-health.md | grep -i 'training'",
      evidence:
        "Strict contractual opt-out agreement prevents telemetry or text payload ingestion into public model iterations.",
    },
  },
  {
    id: "SEC-AI-03",
    category: "Vector Isolation",
    title: "Multi-Tenant Vector DB Namespace Segregation",
    description:
      "Pinecone vector indexes partition semantic embeddings by non-fungible Organization ID namespaces. Query predicates enforce tenant filtering at the storage layer.",
    enforcement:
      "Hardened Vector Search Service (`server/services/vectorSearch.js`)",
    frameworks: [
      { name: "SOC 2", ref: "CC6.1, CC6.3" },
      { name: "ISO 27001", ref: "A.9.4" },
      { name: "FedRAMP", ref: "SC-7" },
    ],
    status: "Enforced",
    auditProof: {
      type: "Automated Code Constraint",
      verificationCmd:
        "grep -rn 'namespace: orgId' server/services/vectorSearch.js",
      evidence:
        "Vector queries explicitly inject authenticated organization namespace IDs before execution.",
    },
  },
  {
    id: "SEC-AI-04",
    category: "Encryption",
    title: "TLS 1.3 Payload Encryption In-Transit",
    description:
      "Client-to-server and server-to-AI microservice communications enforce TLS 1.3 with strict HSTS preloading to prevent transport downgrade attacks.",
    enforcement: "Express Security Middleware (`server/config/helmet.js`)",
    frameworks: [
      { name: "SOC 2", ref: "CC6.7" },
      { name: "HIPAA", ref: "§ 164.312(e)" },
      { name: "ISO 27001", ref: "A.13.2" },
    ],
    status: "Enforced",
    auditProof: {
      type: "TLS Cipher & Header Audit",
      verificationCmd:
        "curl -I -s --tlsv1.3 https://localhost/health | grep Strict-Transport-Security",
      evidence:
        "HSTS max-age is set to 31536000 seconds with mandatory subdomains inclusion in production.",
    },
  },
  {
    id: "SEC-AI-05",
    category: "Encryption",
    title: "AES-256 Storage Engine Encryption At-Rest",
    description:
      "MongoDB Atlas database tables, cloud media storage buckets, and transcript caches are encrypted with 256-bit Advanced Encryption Standard keys.",
    enforcement: "Managed Cloud KMS with Automated Monthly Key Rotation",
    frameworks: [
      { name: "SOC 2", ref: "CC6.1" },
      { name: "HIPAA", ref: "§ 164.312(a)" },
      { name: "GDPR", ref: "Art. 32" },
    ],
    status: "Enforced",
    auditProof: {
      type: "KMS KMS Policy Verification",
      verificationCmd: "aws kms describe-key --key-id alias/meetonmemory-db",
      evidence:
        "Storage volume encryption enforced at infrastructure level across primary and replica regions.",
    },
  },
  {
    id: "SEC-AI-06",
    category: "Access & RBAC",
    title: "Granular Role-Based Access & Resource ACL",
    description:
      "Access to AI meeting summaries, debrief QA, and semantic search is bound to tenant role policies (Owner, Admin, Member, Custom Role ACLs).",
    enforcement: "Middleware `roleCheck` & Custom RBAC Matrix Engine",
    frameworks: [
      { name: "SOC 2", ref: "CC6.1, CC6.2" },
      { name: "ISO 27001", ref: "A.9.2" },
      { name: "CCPA", ref: "Data Access Safeguard" },
    ],
    status: "Enforced",
    auditProof: {
      type: "Role Matrix Endpoint Audit",
      verificationCmd:
        "curl -H 'Authorization: Bearer <token>' /api/admin/rbac/matrix",
      evidence:
        "RBAC Matrix Engine dynamically validates resource-action tuples before evaluating AI route handlers.",
    },
  },
  {
    id: "SEC-AI-07",
    category: "Audit Tracing",
    title: "Structured Audit Logging with Sensitive Data Redaction",
    description:
      "AI inference events log correlation Request IDs, Org IDs, model latencies, and token metrics while automatically stripping tokens, cookies, and secrets.",
    enforcement: "Context Logger (`middleware/requestContext.js`)",
    frameworks: [
      { name: "SOC 2", ref: "CC7.2" },
      { name: "HIPAA", ref: "§ 164.312(b)" },
      { name: "ISO 27001", ref: "A.12.4" },
    ],
    status: "Enforced",
    auditProof: {
      type: "Log Pipeline Inspector",
      verificationCmd: "grep -rn 'redact(' server/middleware/requestContext.js",
      evidence:
        "Sanitization filter strips passwords, authorization headers, and transcripts before writing log streams.",
    },
  },
  {
    id: "SEC-AI-08",
    category: "Zero Retention",
    title: "Prompt Budgeting & Truncation Resilience",
    description:
      "Prevents payload flooding and context memory exhaustion by algorithmically chunking meeting transcripts with semantic seam overlaps.",
    enforcement: "AI Resilience Utility (`server/utils/aiResilience.js`)",
    frameworks: [
      { name: "SOC 2", ref: "CC7.1" },
      { name: "ISO 27001", ref: "A.12.1" },
    ],
    status: "Enforced",
    auditProof: {
      type: "Unit Test Verification",
      verificationCmd: "npm test -- aiResilience.test.js",
      evidence:
        "Evaluates chunking seam overlaps and exponential backoff jitter on rate limit simulations.",
    },
  },
  {
    id: "SEC-AI-09",
    category: "Sub-processors",
    title: "Audited Sub-Processor Boundary Controls",
    description:
      "Maintains a transparent register of cloud providers (AWS, GCP, MongoDB, Pinecone) with active DPA agreements and annual SOC 2 compliance verification.",
    enforcement: "Security Vendor Management & DPA Directory",
    frameworks: [
      { name: "GDPR", ref: "Art. 28" },
      { name: "SOC 2", ref: "CC9.2" },
      { name: "CCPA", ref: "Third-Party Oversight" },
    ],
    status: "Enforced",
    auditProof: {
      type: "DPA Register",
      verificationCmd:
        "cat docs/security-and-health.md | grep -i 'sub-processors'",
      evidence:
        "All third-party data processing boundaries undergo quarterly compliance review and SOC 2 validation.",
    },
  },
  {
    id: "SEC-AI-10",
    category: "Access & RBAC",
    title: "Right-to-be-Forgotten Automated Purge Pipeline",
    description:
      "Organization deletion triggers programmatic purge of MongoDB meeting documents, audio blobs, and Pinecone vector namespace vectors simultaneously.",
    enforcement: "Purge Service Worker & Storage Erasure Handler",
    frameworks: [
      { name: "GDPR", ref: "Art. 17" },
      { name: "CCPA", ref: "§ 1798.105" },
      { name: "ISO 27001", ref: "A.8.3" },
    ],
    status: "Enforced",
    auditProof: {
      type: "Automated Erasure Workflow",
      verificationCmd:
        "grep -rn 'deleteNamespace' server/services/vectorSearch.js",
      evidence:
        "Namespace deletion API immediately purges vector index entries upon organization erasure.",
    },
  },
];

const FRAMEWORK_OPTIONS = [
  "All",
  "SOC 2",
  "GDPR",
  "HIPAA",
  "ISO 27001",
  "CCPA",
  "FedRAMP",
];

const CATEGORY_OPTIONS = [
  "All",
  "Zero Retention",
  "Model Isolation",
  "Vector Isolation",
  "Encryption",
  "Access & RBAC",
  "Audit Tracing",
  "Sub-processors",
];

export default function EnterpriseAiComplianceMatrix() {
  const [selectedFramework, setSelectedFramework] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAuditControl, setSelectedAuditControl] = useState(null);
  const [copiedStatus, setCopiedStatus] = useState(false);

  // Filter controls dynamically
  const filteredControls = useMemo(() => {
    return MATRIX_CONTROLS.filter((ctrl) => {
      // Framework match
      const matchesFramework =
        selectedFramework === "All" ||
        ctrl.frameworks.some((f) => f.name === selectedFramework);

      // Category match
      const matchesCategory =
        selectedCategory === "All" || ctrl.category === selectedCategory;

      // Text search match
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        ctrl.id.toLowerCase().includes(query) ||
        ctrl.title.toLowerCase().includes(query) ||
        ctrl.description.toLowerCase().includes(query) ||
        ctrl.enforcement.toLowerCase().includes(query) ||
        ctrl.frameworks.some(
          (f) =>
            f.name.toLowerCase().includes(query) ||
            f.ref.toLowerCase().includes(query),
        );

      return matchesFramework && matchesCategory && matchesQuery;
    });
  }, [selectedFramework, selectedCategory, searchQuery]);

  // Export Matrix to CSV
  const handleExportCsv = () => {
    const headers = [
      "Control ID",
      "Category",
      "Title",
      "Description",
      "Enforcement Mechanism",
      "Framework Mappings",
      "Status",
    ];

    const rows = filteredControls.map((ctrl) => [
      `"${ctrl.id}"`,
      `"${ctrl.category}"`,
      `"${ctrl.title.replace(/"/g, '""')}"`,
      `"${ctrl.description.replace(/"/g, '""')}"`,
      `"${ctrl.enforcement.replace(/"/g, '""')}"`,
      `"${ctrl.frameworks.map((f) => `${f.name} (${f.ref})`).join("; ")}"`,
      `"${ctrl.status}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Enterprise_AI_Security_Compliance_Matrix_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy JSON Posture
  const handleCopyJson = () => {
    const postureData = {
      title: "MeetOnMemory Enterprise AI Security & Compliance Matrix",
      generatedAt: new Date().toISOString(),
      controlsCount: filteredControls.length,
      controls: filteredControls,
    };
    navigator.clipboard.writeText(JSON.stringify(postureData, null, 2));
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2500);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-8">
      {/* Header & Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Enterprise Grade Security
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Enterprise AI Security & Compliance Matrix
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-3xl">
            Real-time compliance safeguards mapping MeetOnMemory's stateless AI
            processing, zero-data retention, and vector namespace isolation to
            enterprise compliance standards.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-slate-700/60 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 transition"
            title="Copy JSON Compliance Posture"
          >
            {copiedStatus ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedStatus ? "Copied JSON" : "Copy Posture"}
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export Matrix (CSV)
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Shield className="w-4 h-4" /> Safeguard Status
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            100% Enforced
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Active safeguards across all endpoints
          </p>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Cpu className="w-4 h-4" /> AI Retention
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            0 Days
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            In-memory stateless LLM processing
          </p>
        </div>

        <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Layers className="w-4 h-4" /> Vector Boundary
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            Org Namespace
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Hardened Pinecone tenant isolation
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Lock className="w-4 h-4" /> Encryption Specs
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            TLS 1.3 / AES-256
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Dual envelope transit & storage crypto
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search controls by ID, framework, keyword, or safeguard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-col gap-2">
          {/* Framework pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px] mr-1">
              Framework:
            </span>
            {FRAMEWORK_OPTIONS.map((fw) => (
              <button
                key={fw}
                onClick={() => setSelectedFramework(fw)}
                className={`px-3 py-1 rounded-lg transition font-medium text-xs ${
                  selectedFramework === fw
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 dark:bg-slate-700/60 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                }`}
              >
                {fw}
              </button>
            ))}
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px] mr-1">
              Category:
            </span>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg transition font-medium text-xs ${
                  selectedCategory === cat
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold"
                    : "bg-gray-100 dark:bg-slate-700/40 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Control Matrix Table */}
      <div className="border border-gray-100 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-700/80 text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Control ID</th>
                <th className="py-3.5 px-4">Safeguards & Description</th>
                <th className="py-3.5 px-4">Enforcement Mechanism</th>
                <th className="py-3.5 px-4">Framework Mapping</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Audit Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 text-xs sm:text-sm">
              {filteredControls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Info className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-bold text-gray-800 dark:text-white">
                      No matching compliance controls found
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">
                      Try clearing search queries or adjusting framework
                      filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredControls.map((ctrl) => (
                  <tr
                    key={ctrl.id}
                    className="hover:bg-indigo-50/30 dark:hover:bg-slate-700/20 transition-colors"
                  >
                    {/* ID & Category */}
                    <td className="py-4 px-4 align-top whitespace-nowrap">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {ctrl.id}
                      </span>
                      <div className="mt-1">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                          {ctrl.category}
                        </span>
                      </div>
                    </td>

                    {/* Title & Description */}
                    <td className="py-4 px-4 align-top max-w-md">
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                        {ctrl.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {ctrl.description}
                      </p>
                    </td>

                    {/* Enforcement Mechanism */}
                    <td className="py-4 px-4 align-top max-w-xs text-xs font-medium text-gray-700 dark:text-slate-300 leading-normal">
                      <div className="flex items-start gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span>{ctrl.enforcement}</span>
                      </div>
                    </td>

                    {/* Framework Mapping */}
                    <td className="py-4 px-4 align-top">
                      <div className="flex flex-wrap gap-1">
                        {ctrl.frameworks.map((f, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold text-[11px]"
                          >
                            <span>{f.name}:</span>
                            <span className="font-normal opacity-80">
                              {f.ref}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 align-top text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-900/50">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {ctrl.status}
                      </span>
                    </td>

                    {/* Audit Proof Button */}
                    <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedAuditControl(ctrl)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-700/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 text-gray-700 dark:text-slate-200 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect Evidence
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Evidence Modal Drawer */}
      {selectedAuditControl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 relative animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-md">
                  {selectedAuditControl.id}
                </span>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  Audit Evidence Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedAuditControl(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                  {selectedAuditControl.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {selectedAuditControl.description}
                </p>
              </div>

              {/* Evidence Type */}
              <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    Evidence Category:
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {selectedAuditControl.auditProof.type}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <span className="text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider block">
                    Verification Code Command:
                  </span>
                  <div className="p-2.5 bg-slate-950 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto border border-slate-800 flex items-center justify-between gap-2">
                    <code>
                      {selectedAuditControl.auditProof.verificationCmd}
                    </code>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          selectedAuditControl.auditProof.verificationCmd,
                        )
                      }
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white shrink-0"
                      title="Copy command"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs pt-1">
                  <span className="text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1">
                    Audit Verification Statement:
                  </span>
                  <p className="text-gray-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-gray-100 dark:border-slate-700/60">
                    {selectedAuditControl.auditProof.evidence}
                  </p>
                </div>
              </div>

              {/* Framework Alignment */}
              <div>
                <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                  Mapped Regulatory Directives:
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedAuditControl.frameworks.map((f, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/50 text-xs font-semibold"
                    >
                      {f.name}: {f.ref}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedAuditControl(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
