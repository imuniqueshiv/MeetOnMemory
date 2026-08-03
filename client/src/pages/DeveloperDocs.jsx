import React, { useState, useMemo } from "react";
import Navbar from "../components/Navbar.jsx";
import {
  BookOpen,
  Code2,
  Key,
  Zap,
  Copy,
  Check,
  Search,
  ShieldCheck,
  Server,
  Lock,
  Cpu,
  Webhook,
  Calendar,
  FileText,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

// API Endpoints Catalog
const API_ENDPOINTS = [
  {
    id: "auth-is-auth",
    category: "Authentication",
    method: "GET",
    path: "/api/auth/is-auth",
    title: "Check Session",
    description:
      "Verify the current Clerk Bearer session and confirm the linked MongoDB user.",
    authRequired: true,
    requestBody: null,
    response200: {
      success: true,
    },
    snippets: {
      curl: `curl -X GET http://localhost:4000/api/auth/is-auth \\
  -H "Authorization: Bearer YOUR_CLERK_SESSION_JWT"`,
      javascript: `fetch('http://localhost:4000/api/auth/is-auth', {
  headers: { Authorization: 'Bearer YOUR_CLERK_SESSION_JWT' }
})
.then(res => res.json())
.then(data => console.log(data));`,
      nodejs: `const axios = require('axios');

const res = await axios.get('http://localhost:4000/api/auth/is-auth', {
  headers: { Authorization: 'Bearer YOUR_CLERK_SESSION_JWT' }
});
console.log(res.data);`,
      python: `import requests

url = "http://localhost:4000/api/auth/is-auth"
headers = {"Authorization": "Bearer YOUR_CLERK_SESSION_JWT"}

response = requests.get(url, headers=headers)
print(response.json())`,
    },
  },
  {
    id: "auth-sync-clerk",
    category: "Authentication",
    method: "POST",
    path: "/api/auth/sync-clerk-user",
    title: "Sync Clerk User",
    description:
      "Provision or link the Clerk identity to a MongoDB user (idempotent).",
    authRequired: true,
    requestBody: {},
    response200: {
      success: true,
      message: "User synchronized successfully",
      user: {
        id: "65f2a1b3c8e90d1234567890",
        name: "Dev User",
        email: "developer@example.com",
        role: "admin",
      },
    },
    snippets: {
      curl: `curl -X POST http://localhost:4000/api/auth/sync-clerk-user \\
  -H "Authorization: Bearer YOUR_CLERK_SESSION_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{}'`,
      javascript: `fetch('http://localhost:4000/api/auth/sync-clerk-user', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer YOUR_CLERK_SESSION_JWT',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
})
.then(res => res.json())
.then(data => console.log(data));`,
      nodejs: `const axios = require('axios');

const res = await axios.post(
  'http://localhost:4000/api/auth/sync-clerk-user',
  {},
  { headers: { Authorization: 'Bearer YOUR_CLERK_SESSION_JWT' } }
);
console.log(res.data);`,
      python: `import requests

url = "http://localhost:4000/api/auth/sync-clerk-user"
headers = {
  "Authorization": "Bearer YOUR_CLERK_SESSION_JWT",
  "Content-Type": "application/json",
}

response = requests.post(url, json={}, headers=headers)
print(response.json())`,
    },
  },
  {
    id: "meetings-create",
    category: "Meetings",
    method: "POST",
    path: "/api/meetings/create",
    title: "Schedule Meeting",
    description:
      "Create and schedule a new meeting record with optional calendar sync.",
    authRequired: true,
    requestBody: {
      title: "Q3 Engineering Planning",
      description: "Discuss architecture and roadmap for Q3",
      meetingType: "conference",
      date: "2026-08-15T10:00:00.000Z",
      time: "10:00",
      duration: 60,
      location: "Zoom",
      venue: "https://zoom.us/j/123456789",
      syncToCalendar: true,
      participants: [
        { name: "Alice Smith", email: "alice@example.com", role: "Organizer" },
        { name: "Bob Jones", email: "bob@example.com", role: "Attendee" },
      ],
    },
    response200: {
      success: true,
      message: "Meeting scheduled successfully",
      meeting: {
        _id: "66a4f912e8b23c0012345678",
        title: "Q3 Engineering Planning",
        date: "2026-08-15T10:00:00.000Z",
        meetingType: "conference",
        status: "uploaded",
      },
    },
    snippets: {
      curl: `curl -X POST http://localhost:4000/api/meetings/create \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Q3 Engineering Planning",
    "date": "2026-08-15T10:00:00.000Z",
    "duration": 60,
    "syncToCalendar": true
  }'`,
      javascript: `fetch('http://localhost:4000/api/meetings/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Q3 Engineering Planning',
    date: '2026-08-15T10:00:00.000Z',
    duration: 60,
    syncToCalendar: true
  })
})
.then(res => res.json())
.then(data => console.log(data));`,
      nodejs: `const axios = require('axios');

const res = await axios.post('http://localhost:4000/api/meetings/create', {
  title: 'Q3 Engineering Planning',
  date: '2026-08-15T10:00:00.000Z',
  duration: 60,
  syncToCalendar: true
}, {
  headers: { Authorization: 'Bearer YOUR_ACCESS_TOKEN' }
});
console.log(res.data);`,
      python: `import requests

url = "http://localhost:4000/api/meetings/create"
headers = {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN",
    "Content-Type": "application/json"
}
payload = {
    "title": "Q3 Engineering Planning",
    "date": "2026-08-15T10:00:00.000Z",
    "duration": 60,
    "syncToCalendar": True
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
    },
  },
  {
    id: "meetings-list",
    category: "Meetings",
    method: "GET",
    path: "/api/meetings",
    title: "Get All Meetings",
    description:
      "Fetch paginated list of meetings with optional filtering by status and type.",
    authRequired: true,
    queryParams: "?page=1&limit=10&meetingType=conference",
    response200: {
      success: true,
      meetings: [
        {
          _id: "66a4f912e8b23c0012345678",
          title: "Q3 Engineering Planning",
          date: "2026-08-15T10:00:00.000Z",
          status: "uploaded",
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        pages: 1,
      },
    },
    snippets: {
      curl: `curl -X GET "http://localhost:4000/api/meetings?page=1&limit=10" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`,
      javascript: `fetch('http://localhost:4000/api/meetings?page=1&limit=10', {
  headers: { 'Authorization': 'Bearer YOUR_ACCESS_TOKEN' }
})
.then(res => res.json())
.then(data => console.log(data));`,
      nodejs: `const axios = require('axios');

const res = await axios.get('http://localhost:4000/api/meetings', {
  params: { page: 1, limit: 10 },
  headers: { Authorization: 'Bearer YOUR_ACCESS_TOKEN' }
});
console.log(res.data);`,
      python: `import requests

url = "http://localhost:4000/api/meetings"
headers = {"Authorization": "Bearer YOUR_ACCESS_TOKEN"}
params = {"page": 1, "limit": 10}

response = requests.get(url, headers=headers, params=params)
print(response.json())`,
    },
  },
  {
    id: "calendar-freebusy",
    category: "Calendar Sync",
    method: "POST",
    path: "/api/calendar/freebusy",
    title: "Get Attendee Free/Busy Availability",
    description:
      "Fetch free/busy blocks for attendee emails across Google Calendar & Microsoft Outlook.",
    authRequired: true,
    requestBody: {
      attendeeEmails: ["alice@example.com", "bob@example.com"],
      timeMin: "2026-08-15T08:00:00.000Z",
      timeMax: "2026-08-15T18:00:00.000Z",
    },
    response200: {
      success: true,
      data: {
        google: {
          "alice@example.com": {
            busy: [
              {
                start: "2026-08-15T11:00:00.000Z",
                end: "2026-08-15T12:00:00.000Z",
              },
            ],
          },
        },
        microsoft: [],
      },
    },
    snippets: {
      curl: `curl -X POST http://localhost:4000/api/calendar/freebusy \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "attendeeEmails": ["alice@example.com"],
    "timeMin": "2026-08-15T08:00:00Z",
    "timeMax": "2026-08-15T18:00:00Z"
  }'`,
      javascript: `fetch('http://localhost:4000/api/calendar/freebusy', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    attendeeEmails: ['alice@example.com'],
    timeMin: '2026-08-15T08:00:00Z',
    timeMax: '2026-08-15T18:00:00Z'
  })
})
.then(res => res.json())
.then(data => console.log(data));`,
      nodejs: `const axios = require('axios');

const res = await axios.post('http://localhost:4000/api/calendar/freebusy', {
  attendeeEmails: ['alice@example.com'],
  timeMin: '2026-08-15T08:00:00Z',
  timeMax: '2026-08-15T18:00:00Z'
}, {
  headers: { Authorization: 'Bearer YOUR_ACCESS_TOKEN' }
});
console.log(res.data);`,
      python: `import requests

url = "http://localhost:4000/api/calendar/freebusy"
headers = {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN",
    "Content-Type": "application/json"
}
payload = {
    "attendeeEmails": ["alice@example.com"],
    "timeMin": "2026-08-15T08:00:00Z",
    "timeMax": "2026-08-15T18:00:00Z"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
    },
  },
  {
    id: "ai-assistant-query",
    category: "AI Assistant & RAG",
    method: "POST",
    path: "/api/assistant/chat",
    title: "AI RAG Assistant Query",
    description:
      "Query AI assistant with hybrid semantic search across organization knowledge graphs and meeting minutes.",
    authRequired: true,
    requestBody: {
      message: "What were the key decisions made in the last product meeting?",
      conversationId: "conv-12345",
    },
    response200: {
      success: true,
      reply:
        "In the last product meeting on Aug 10, the team decided to migrate to PostgreSQL and launch the calendar sync integration.",
      citations: [
        {
          meetingId: "66a4f912e8b23c0012345678",
          title: "Product Strategy Sync",
        },
      ],
    },
    snippets: {
      curl: `curl -X POST http://localhost:4000/api/assistant/chat \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "What key decisions were made recently?"}'`,
      javascript: `fetch('http://localhost:4000/api/assistant/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ message: 'What key decisions were made recently?' })
})
.then(res => res.json())
.then(data => console.log(data));`,
      nodejs: `const axios = require('axios');

const res = await axios.post('http://localhost:4000/api/assistant/chat', {
  message: 'What key decisions were made recently?'
}, {
  headers: { Authorization: 'Bearer YOUR_ACCESS_TOKEN' }
});
console.log(res.data);`,
      python: `import requests

url = "http://localhost:4000/api/assistant/chat"
headers = {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN",
    "Content-Type": "application/json"
}
payload = {"message": "What key decisions were made recently?"}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
    },
  },
  {
    id: "webhooks-register",
    category: "Webhooks",
    method: "POST",
    path: "/api/webhooks/register",
    title: "Register Webhook Endpoint",
    description:
      "Subscribe an external HTTPS endpoint to real-time events (e.g. meeting.created, mom.generated).",
    authRequired: true,
    requestBody: {
      targetUrl: "https://example.com/api/webhooks/meet-on-memory",
      events: ["meeting.created", "meeting.updated", "mom.generated"],
      secret: "whsec_sample_secret_key_123",
    },
    response200: {
      success: true,
      webhook: {
        id: "wh_987654321",
        targetUrl: "https://example.com/api/webhooks/meet-on-memory",
        events: ["meeting.created", "meeting.updated", "mom.generated"],
        active: true,
        createdAt: "2026-07-28T12:00:00.000Z",
      },
    },
    snippets: {
      curl: `curl -X POST http://localhost:4000/api/webhooks/register \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "targetUrl": "https://example.com/webhook",
    "events": ["meeting.created", "mom.generated"]
  }'`,
      javascript: `fetch('http://localhost:4000/api/webhooks/register', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    targetUrl: 'https://example.com/webhook',
    events: ['meeting.created', 'mom.generated']
  })
})
.then(res => res.json())
.then(data => console.log(data));`,
      nodejs: `const axios = require('axios');

const res = await axios.post('http://localhost:4000/api/webhooks/register', {
  targetUrl: 'https://example.com/webhook',
  events: ['meeting.created', 'mom.generated']
}, {
  headers: { Authorization: 'Bearer YOUR_ACCESS_TOKEN' }
});
console.log(res.data);`,
      python: `import requests

url = "http://localhost:4000/api/webhooks/register"
headers = {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN",
    "Content-Type": "application/json"
}
payload = {
    "targetUrl": "https://example.com/webhook",
    "events": ["meeting.created", "mom.generated"]
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
    },
  },
];

const DeveloperDocs = () => {
  const [activeSection, setActiveSection] = useState("overview");
  const [activeLanguage, setActiveLanguage] = useState("curl");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Copy code helper
  const handleCopy = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter endpoints based on search query
  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return API_ENDPOINTS;
    const q = searchQuery.toLowerCase();
    return API_ENDPOINTS.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        ep.path.toLowerCase().includes(q) ||
        ep.category.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans">
      <Navbar />

      {/* Hero / Portal Header */}
      <section className="bg-linear-to-r from-slate-900 via-blue-950 to-slate-900 text-white pt-28 pb-14 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Developer Documentation Portal
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Build & Integrate with MeetOnMemory
              </h1>
              <p className="mt-2 text-slate-300 text-sm sm:text-base max-w-2xl">
                Comprehensive API references, authentication guides, interactive
                code SDK samples, and real-time webhook guides.
              </p>
            </div>

            {/* Quick Stats Badges */}
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                REST & Socket.IO APIs
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                JWT & OAuth2 Auth
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                Multi-Language SDKs
              </span>
            </div>
          </div>

          {/* Instant Search Bar */}
          <div className="mt-8 relative max-w-xl">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search endpoints, authentication, webhooks, or guides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3 text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-md bg-slate-700/60"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Documentation Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full flex flex-col md:flex-row gap-8">
        {/* Sticky Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs sticky top-24">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 px-2">
              Navigation
            </h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveSection("overview")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-left ${
                  activeSection === "overview"
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                Overview
              </button>

              <button
                onClick={() => setActiveSection("quickstart")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-left ${
                  activeSection === "quickstart"
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Zap className="w-4 h-4 shrink-0" />
                Quick Start Guide
              </button>

              <button
                onClick={() => setActiveSection("auth")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-left ${
                  activeSection === "auth"
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Key className="w-4 h-4 shrink-0" />
                Authentication
              </button>

              <button
                onClick={() => setActiveSection("api-reference")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-left ${
                  activeSection === "api-reference"
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Code2 className="w-4 h-4 shrink-0" />
                API Reference
              </button>

              <button
                onClick={() => setActiveSection("webhooks")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-left ${
                  activeSection === "webhooks"
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Webhook className="w-4 h-4 shrink-0" />
                Webhooks Guide
              </button>

              <button
                onClick={() => setActiveSection("best-practices")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-left ${
                  activeSection === "best-practices"
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Best Practices
              </button>

              <button
                onClick={() => setActiveSection("errors")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-left ${
                  activeSection === "errors"
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Error Handling
              </button>
            </nav>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 mb-2">
                API Base URL
              </h3>
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all select-all border border-slate-200 dark:border-slate-700">
                http://localhost:4000
              </div>
            </div>
          </div>
        </aside>

        {/* Documentation Content Column */}
        <main className="flex-1 space-y-8 min-w-0">
          {/* SECTION: OVERVIEW */}
          {activeSection === "overview" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      MeetOnMemory Developer Platform
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Platform architecture, key features, and core endpoints
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                  MeetOnMemory provides powerful REST and WebSocket APIs to
                  programmatically manage meetings, generate structured AI
                  minutes of meeting (MoM), query hybrid RAG knowledge graphs,
                  synchronize Google & Microsoft Outlook calendars, and handle
                  real-time webhook event notifications.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white mb-1">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Meeting Management
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Create, upload audio/transcripts, edit, and organize
                      meeting records seamlessly.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white mb-1">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      Two-Way Calendar Sync
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Two-way event propagation and free/busy availability grid
                      for Google & Outlook.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white mb-1">
                      <Cpu className="w-4 h-4 text-emerald-500" />
                      AI RAG & Knowledge Graph
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Hybrid vector and graph memory search using Google Gemini
                      & Pinecone embeddings.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white mb-1">
                      <Webhook className="w-4 h-4 text-amber-500" />
                      Real-time Webhooks
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Receive instant HTTP callbacks when meetings are created,
                      processed, or summarized.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: QUICK START */}
          {activeSection === "quickstart" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Quick Start Guide
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Make your first API request in 3 simple steps
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                      1
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        Authenticate with Clerk
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Sign in via the MeetOnMemory Clerk UI (
                        <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">
                          /login
                        </code>
                        ). Use the Clerk session JWT as{" "}
                        <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">
                          Authorization: Bearer …
                        </code>{" "}
                        on API requests.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                      2
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        Set Authorization Header
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Include the JWT token in all protected API requests via
                        the standard HTTP header:
                      </p>
                      <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs select-all">
                        Authorization: Bearer YOUR_ACCESS_TOKEN
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                      3
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        Make Your First API Call
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Fetch your meetings list using cURL or JavaScript:
                      </p>
                      <div className="mt-2 relative bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                        <code>
                          curl -X GET http://localhost:4000/api/meetings \<br />
                          &nbsp;&nbsp;-H "Authorization: Bearer
                          YOUR_ACCESS_TOKEN"
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: AUTHENTICATION */}
          {activeSection === "auth" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600 dark:text-purple-400">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Authentication & Security
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Bearer tokens, CSRF protection, and OAuth integrations
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    MeetOnMemory uses **JSON Web Tokens (JWT)** for user session
                    authentication. All protected endpoints require a valid JWT
                    token passed in the{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">
                      Authorization
                    </code>{" "}
                    header.
                  </p>

                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <Lock className="w-4 h-4" />
                      Security Note
                    </div>
                    Keep access tokens secure. Never commit tokens to public
                    repositories or expose them in client-side client browser
                    logs.
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white pt-2">
                    OAuth Provider Scopes
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="font-bold text-slate-900 dark:text-white block mb-1">
                        Google Calendar
                      </span>
                      <code className="text-[11px] text-blue-600 dark:text-blue-400 block font-mono">
                        https://www.googleapis.com/auth/calendar
                      </code>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="font-bold text-slate-900 dark:text-white block mb-1">
                        Microsoft Graph
                      </span>
                      <code className="text-[11px] text-blue-600 dark:text-blue-400 block font-mono">
                        https://graph.microsoft.com/Calendars.ReadWrite
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: API REFERENCE (CATALOG) */}
          {(activeSection === "api-reference" || searchQuery.trim() !== "") && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    API Endpoint Reference
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Showing {filteredEndpoints.length} endpoint(s)
                  </p>
                </div>

                {/* Code Snippet Language Selector */}
                <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-300 dark:border-slate-700">
                  {["curl", "javascript", "nodejs", "python"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setActiveLanguage(lang)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                        activeLanguage === lang
                          ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      {lang === "curl"
                        ? "cURL"
                        : lang === "nodejs"
                          ? "Node.js"
                          : lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoints Loop */}
              <div className="space-y-6">
                {filteredEndpoints.map((ep) => (
                  <div
                    key={ep.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
                  >
                    {/* Endpoint Header Bar */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider ${
                            ep.method === "GET"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          {ep.method}
                        </span>
                        <code className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                          {ep.path}
                        </code>
                      </div>

                      <div className="flex items-center gap-2">
                        {ep.authRequired ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                            <Lock className="w-3 h-3" /> Auth Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            Public
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-200/60 dark:bg-slate-800 rounded-md">
                          {ep.category}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {ep.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {ep.description}
                        </p>
                      </div>

                      {/* Code Snippet Block */}
                      <div>
                        <div className="flex items-center justify-between bg-slate-800 text-slate-400 px-4 py-2 rounded-t-xl text-xs font-mono border-b border-slate-700">
                          <span>Example Request ({activeLanguage})</span>
                          <button
                            onClick={() =>
                              handleCopy(ep.snippets[activeLanguage], ep.id)
                            }
                            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedId === ep.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-bold">
                                  Copied!
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-b-xl font-mono text-xs overflow-x-auto select-all">
                          <code>{ep.snippets[activeLanguage]}</code>
                        </pre>
                      </div>

                      {/* Response Payload Sample */}
                      <div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <span>Response Sample</span>
                          <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            200 OK
                          </span>
                        </div>
                        <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto select-all">
                          <code>{JSON.stringify(ep.response200, null, 2)}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: WEBHOOKS */}
          {activeSection === "webhooks" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
                    <Webhook className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Webhooks & Real-time Callbacks
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Receive instant HTTP payloads on asynchronous meeting
                      events
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    Webhooks allow external applications to receive automated
                    HTTP callbacks whenever specific events occur in
                    MeetOnMemory.
                  </p>

                  <h3 className="font-bold text-slate-900 dark:text-white pt-2">
                    Supported Event Types
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <code className="font-bold text-blue-600 dark:text-blue-400 block mb-1">
                        meeting.created
                      </code>
                      <span>
                        Fired when a new meeting is scheduled or uploaded.
                      </span>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <code className="font-bold text-blue-600 dark:text-blue-400 block mb-1">
                        meeting.updated
                      </code>
                      <span>
                        Fired when meeting details or timings are edited.
                      </span>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <code className="font-bold text-blue-600 dark:text-blue-400 block mb-1">
                        mom.generated
                      </code>
                      <span>
                        Fired when AI minutes of meeting synthesis finishes.
                      </span>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <code className="font-bold text-blue-600 dark:text-blue-400 block mb-1">
                        calendar.synced
                      </code>
                      <span>
                        Fired when two-way calendar reconciliation completes.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: BEST PRACTICES */}
          {activeSection === "best-practices" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Recommended Development Best Practices
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Rate limits, pagination, retry strategy, and security
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                      1. Rate Limiting Guidelines
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      General API endpoints allow up to **100 requests per
                      minute per IP**. High-cost operations (such as AI MoM
                      generation) are throttled via BullMQ background job
                      queues.
                    </p>
                  </div>

                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                      2. Efficient Pagination
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Always pass{" "}
                      <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded font-mono">
                        page
                      </code>{" "}
                      and{" "}
                      <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded font-mono">
                        limit
                      </code>{" "}
                      query parameters when retrieving list data to minimize
                      response latency.
                    </p>
                  </div>

                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                      3. Idempotency & Retries
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Use exponential backoff when retrying failed requests.
                      Ensure webhook processing handlers are idempotent.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: ERROR HANDLING */}
          {activeSection === "errors" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Standard Error Codes & Handling
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Understanding HTTP status codes and error JSON payloads
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                        <th className="p-3">Status Code</th>
                        <th className="p-3">Error Name</th>
                        <th className="p-3">Description & Resolution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="p-3 font-mono font-bold text-amber-600">
                          400 Bad Request
                        </td>
                        <td className="p-3 font-semibold">ValidationError</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          Invalid parameters or failed schema validation. Check
                          payload.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-rose-600">
                          401 Unauthorized
                        </td>
                        <td className="p-3 font-semibold">UnauthorizedError</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          Missing or invalid Bearer token. Re-authenticate to
                          get a token.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-purple-600">
                          403 Forbidden
                        </td>
                        <td className="p-3 font-semibold">ForbiddenError</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          Insufficient role permissions for requested resource.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-600">
                          404 Not Found
                        </td>
                        <td className="p-3 font-semibold">NotFoundError</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          Target resource or endpoint does not exist.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-red-600">
                          429 Too Many Requests
                        </td>
                        <td className="p-3 font-semibold">RateLimitError</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          Rate limit exceeded. Wait before sending additional
                          requests.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                    Standard Error Payload Format
                  </h3>
                  <pre className="bg-slate-900 text-rose-400 p-4 rounded-xl font-mono text-xs overflow-x-auto select-all">
                    <code>
                      {JSON.stringify(
                        {
                          success: false,
                          message: "Invalid or missing Bearer token",
                          errorCode: "UNAUTHORIZED_ACCESS",
                        },
                        null,
                        2,
                      )}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DeveloperDocs;
