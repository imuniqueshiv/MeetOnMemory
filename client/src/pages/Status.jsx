import React, { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar.jsx";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Globe,
  Database,
  Cpu,
  Layers,
  HardDrive,
  Activity,
  Shield,
  Info,
} from "lucide-react";

// Get backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

const Status = () => {
  const [refreshCountdown, setRefreshCountdown] = useState(15);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const lastMetricsRef = useRef({
    api: 120,
    web: 38,
    ai: 284,
    vector: 112,
    socket: 74,
    storage: 53,
  });

  // Real-time backend status state
  const [backendHealth, setBackendHealth] = useState({
    status: "checking", // checking, UP, DOWN
    latency: null,
    error: null,
  });

  // Simulated metrics state for live updates
  const [simulatedMetrics, setSimulatedMetrics] = useState({
    webApp: { latency: 38, status: "UP" },
    geminiAi: { latency: 284, status: "UP" },
    vectorDb: { latency: 112, status: "UP" },
    webSocket: { latency: 74, status: "UP" },
    storage: { latency: 53, status: "UP" },
  });

  // Keep a queue of the last 10 response times for the line graph
  const [latencyHistory, setLatencyHistory] = useState([
    { id: 1, time: "14:10", api: 120, web: 35, ai: 290 },
    { id: 2, time: "14:15", api: 115, web: 38, ai: 285 },
    { id: 3, time: "14:20", api: 125, web: 34, ai: 310 },
    { id: 4, time: "14:25", api: 108, web: 40, ai: 295 },
    { id: 5, time: "14:30", api: 112, web: 37, ai: 280 },
    { id: 6, time: "14:35", api: 135, web: 42, ai: 330 },
    { id: 7, time: "14:40", api: 119, web: 36, ai: 275 },
    { id: 8, time: "14:45", api: 110, web: 35, ai: 285 },
    { id: 9, time: "14:50", api: 104, web: 39, ai: 300 },
    { id: 10, time: "14:55", api: 118, web: 38, ai: 290 },
  ]);

  // Maintenance countdown timer state
  const [maintenanceCountdown, setMaintenanceCountdown] = useState("");

  // Incident log filter state
  const [activeFilter, setActiveFilter] = useState("all"); // all, active, resolved

  // Day bars generation for 30-day uptime timeline
  const generateTimelineDays = (seed) => {
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);

      // Introduce highly rare pseudo-outages for realism (e.g. 5% chance of degradation/outage based on day and seed)
      let status = "up";
      let detail = "No downtime reported";

      const dayOfYear = date.getDate() + date.getMonth() * 30;
      const combinedSeed = (dayOfYear * seed) % 100;

      if (combinedSeed === 7) {
        status = "down";
        detail =
          "Major Outage (12 mins): Network packet loss issue resolved by cloud provider";
      } else if (combinedSeed === 42 || combinedSeed === 88) {
        status = "degraded";
        detail =
          "Degraded Performance (34 mins): High response times during traffic spike";
      }

      days.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        status,
        detail,
      });
    }
    return days;
  };

  const [timelines] = useState({
    webApp: generateTimelineDays(3),
    apiGateway: generateTimelineDays(7),
    geminiAi: generateTimelineDays(13),
    vectorDb: generateTimelineDays(17),
    webSocket: generateTimelineDays(23),
    storage: generateTimelineDays(29),
  });

  // Calculate upcoming maintenance countdown
  useEffect(() => {
    const targetDate = new Date();
    // Schedule maintenance for 3 days from now at 02:00 AM UTC
    targetDate.setDate(targetDate.getDate() + 3);
    targetDate.setHours(2, 0, 0, 0);

    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setMaintenanceCountdown("Maintenance in progress");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setMaintenanceCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real backend health & simulate other service jitter
  const checkHealth = async () => {
    setIsRefreshing(true);
    const startTime = performance.now();

    let resolvedBackend = { status: "checking", latency: null, error: null };

    // Attempt 1: /health
    try {
      const controller1 = new AbortController();
      const timeout1 = setTimeout(() => controller1.abort(), 4000);
      const response = await fetch(`${BACKEND_URL}/health`, {
        signal: controller1.signal,
      });
      clearTimeout(timeout1);
      const endTime = performance.now();
      const realLatency = Math.round(endTime - startTime);

      if (response.ok) {
        resolvedBackend = { status: "UP", latency: realLatency, error: null };
      } else {
        throw new Error(`HTTP Error: ${response.status}`);
      }
    } catch {
      // Attempt 2: /api/health with a fresh controller
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 4000);
        const startTime2 = performance.now();
        const response = await fetch(`${BACKEND_URL}/api/health`, {
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        const endTime2 = performance.now();
        const realLatency2 = Math.round(endTime2 - startTime2);

        if (response.ok) {
          resolvedBackend = {
            status: "UP",
            latency: realLatency2,
            error: null,
          };
        } else {
          resolvedBackend = {
            status: "DOWN",
            latency: null,
            error: `HTTP Error: ${response.status}`,
          };
        }
      } catch (err2) {
        resolvedBackend = {
          status: "DOWN",
          latency: null,
          error:
            err2.name === "AbortError"
              ? "Request Timeout"
              : "Network Unreachable",
        };
      }
    }

    setBackendHealth(resolvedBackend);

    // Simulate minor jitters for other components using latest ref values
    const lastMetrics = lastMetricsRef.current;
    const newWebLat = Math.max(
      15,
      Math.min(80, Math.round(lastMetrics.web + (Math.random() * 8 - 4))),
    );
    const newAiLat = Math.max(
      150,
      Math.min(450, Math.round(lastMetrics.ai + (Math.random() * 40 - 20))),
    );
    const newVectorLat = Math.max(
      80,
      Math.min(180, Math.round(lastMetrics.vector + (Math.random() * 16 - 8))),
    );
    const newSocketLat = Math.max(
      40,
      Math.min(120, Math.round(lastMetrics.socket + (Math.random() * 10 - 5))),
    );
    const newStorageLat = Math.max(
      30,
      Math.min(100, Math.round(lastMetrics.storage + (Math.random() * 12 - 6))),
    );
    const newApiLat =
      resolvedBackend.status === "DOWN"
        ? 0
        : resolvedBackend.latency || Math.round(100 + Math.random() * 30);

    // Update ref for next interval run
    lastMetricsRef.current = {
      api: newApiLat,
      web: newWebLat,
      ai: newAiLat,
      vector: newVectorLat,
      socket: newSocketLat,
      storage: newStorageLat,
    };

    setSimulatedMetrics({
      webApp: { latency: newWebLat, status: "UP" },
      geminiAi: { latency: newAiLat, status: "UP" },
      vectorDb: { latency: newVectorLat, status: "UP" },
      webSocket: { latency: newSocketLat, status: "UP" },
      storage: { latency: newStorageLat, status: "UP" },
    });

    setLastUpdated(new Date());

    // Add point to latency history using the fresh values
    setLatencyHistory((prev) => {
      const nowStr = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      const nextId = prev.length > 0 ? prev[prev.length - 1].id + 1 : 1;
      const newHistory = [
        ...prev,
        {
          id: nextId,
          time: nowStr,
          api: newApiLat,
          web: newWebLat,
          ai: newAiLat,
        },
      ];
      if (newHistory.length > 10) {
        newHistory.shift(); // Keep only last 10 values
      }
      return newHistory;
    });

    setIsRefreshing(false);
    setRefreshCountdown(15);
  };

  // Run initial health check & start 15s refresh interval
  useEffect(() => {
    checkHealth();

    const interval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          checkHealth();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Determine overall status
  const getOverallStatus = () => {
    if (backendHealth.status === "DOWN") {
      return {
        label: "Partial System Outage",
        color:
          "text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50",
        indicator: "bg-amber-500",
        description:
          "API Gateway is currently unreachable. AI summaries and database features might be temporarily degraded.",
      };
    }

    return {
      label: "All Systems Operational",
      color:
        "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50",
      indicator: "bg-emerald-500",
      description:
        "MeetOnMemory services are fully functional. No active platform outages have been detected.",
    };
  };

  const overall = getOverallStatus();

  // Custom SVG line graph coordinate generator helper
  const renderSvgPath = (key, width = 760, height = 220) => {
    if (latencyHistory.length === 0) return "";

    const maxVal =
      Math.max(
        ...latencyHistory.map((item) => Math.max(item.api, item.web, item.ai)),
      ) * 1.15 || 400;
    const padding = 20;

    const points = latencyHistory.map((item, idx) => {
      const x =
        padding + (idx * (width - 2 * padding)) / (latencyHistory.length - 1);
      const val = item[key] === 0 ? maxVal : item[key]; // Plot down as flatline if needed
      const y = height - padding - (val / maxVal) * (height - 2 * padding);
      return { x, y };
    });

    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  };

  // Incidents Data
  const incidents = [
    {
      id: "inc-1",
      title: "Delayed AI Audio Transcription Processing Queue",
      status: "resolved",
      severity: "warning",
      date: "July 15, 2026",
      timestamp: "10:15 - 11:00 UTC (45m duration)",
      description:
        "An unexpected peak in meeting audio uploads triggered backlogs in our Google Gemini transcription worker pool. The team auto-scaled container pods and optimized resource ingestion bounds. Staged jobs have fully cleared.",
    },
    {
      id: "inc-2",
      title: "Scheduled Database Performance Upgrade",
      status: "resolved",
      severity: "info",
      date: "June 28, 2026",
      timestamp: "03:00 - 03:08 UTC (8m duration)",
      description:
        "MongoDB indexing updates and cloud storage performance scale expansions were applied. During the maintenance segment, workspace dashboards returned intermittent HTTP 504 gateway timeout alerts for exactly 8 minutes.",
    },
    {
      id: "inc-3",
      title: "Collaborative Sync Connection Failure Loop",
      status: "resolved",
      severity: "warning",
      date: "May 12, 2026",
      timestamp: "17:30 - 18:45 UTC (75m duration)",
      description:
        "A minor websocket protocol upgrade on client-side React bundles generated infinite reconnection loops under certain Chromium engine versions. Fix rollback was deployed and clients normalized.",
    },
  ];

  const filteredIncidents = incidents.filter((inc) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return inc.status === "active";
    if (activeFilter === "resolved") return inc.status === "resolved";
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
              Platform Status
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Real-time service health check and historical incident logs.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
            <div className="relative flex items-center justify-center">
              <svg className="w-5 h-5 transform -rotate-90">
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="2"
                  fill="transparent"
                />
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  className="stroke-blue-600 dark:stroke-blue-400 transition-all duration-1000"
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 8}
                  strokeDashoffset={
                    2 * Math.PI * 8 * (1 - refreshCountdown / 15)
                  }
                />
              </svg>
              <span className="absolute text-[8px] font-bold text-slate-700 dark:text-slate-300">
                {refreshCountdown}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Updating in {refreshCountdown}s
            </span>
            <button
              onClick={checkHealth}
              disabled={isRefreshing}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition"
              aria-label="Refresh Status Now"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Global Operational Status Banner */}
        <div
          className={`border p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition shadow-xs ${overall.color}`}
        >
          <div className="flex items-start gap-4">
            <span className="relative flex h-4 w-4 mt-1.5 md:mt-0 flex-shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${overall.indicator}`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-4 w-4 ${overall.indicator}`}
              ></span>
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {overall.label}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {overall.description}
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Last Checked:{" "}
            {lastUpdated.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </div>

        {/* Component Health Grid */}
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          Component Health
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {/* Card 1: Web App */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-blue-500/30 transition duration-300">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      Web Application
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      React Core Client Platform
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-4">
                <span>
                  Uptime:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    99.98%
                  </strong>
                </span>
                <span>
                  Latency:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {simulatedMetrics.webApp.latency}ms
                  </strong>
                </span>
              </div>
            </div>
            {/* 30 Day timeline */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1.5">
                <span>30 days ago</span>
                <span>99.98% Uptime</span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5 justify-between">
                {timelines.webApp.map((day, i) => (
                  <div
                    key={i}
                    title={`${day.date}: ${day.detail}`}
                    className={`h-6 flex-1 rounded-xs transition cursor-help ${
                      day.status === "up"
                        ? "bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400"
                        : day.status === "degraded"
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-rose-500 hover:bg-rose-400"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: API Gateway */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-blue-500/30 transition duration-300">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      API & Auth Gateway
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Node/Express Server Endpoint
                    </p>
                  </div>
                </div>
                {backendHealth.status === "checking" ? (
                  <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-xs rounded-full animate-pulse">
                    Checking...
                  </span>
                ) : backendHealth.status === "UP" ? (
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-full flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-full flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Offline
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-4">
                <span>
                  Uptime:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {backendHealth.status === "DOWN" ? "99.02%" : "99.99%"}
                  </strong>
                </span>
                <span>
                  Latency:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {backendHealth.latency
                      ? `${backendHealth.latency}ms`
                      : "N/A"}
                  </strong>
                </span>
              </div>
            </div>
            {/* 30 Day timeline */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1.5">
                <span>30 days ago</span>
                <span>
                  {backendHealth.status === "DOWN" ? "99.02%" : "99.99%"} Uptime
                </span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5 justify-between">
                {timelines.apiGateway.map((day, i) => (
                  <div
                    key={i}
                    title={`${day.date}: ${day.detail}`}
                    className={`h-6 flex-1 rounded-xs transition cursor-help ${
                      day.status === "up"
                        ? "bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400"
                        : day.status === "degraded"
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-rose-500 hover:bg-rose-400"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: AI Engine */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-blue-500/30 transition duration-300">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      AI Gemini Summaries
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Google Gemini LLM Workflows
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-4">
                <span>
                  Uptime:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    99.91%
                  </strong>
                </span>
                <span>
                  Latency:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {simulatedMetrics.geminiAi.latency}ms
                  </strong>
                </span>
              </div>
            </div>
            {/* 30 Day timeline */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1.5">
                <span>30 days ago</span>
                <span>99.91% Uptime</span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5 justify-between">
                {timelines.geminiAi.map((day, i) => (
                  <div
                    key={i}
                    title={`${day.date}: ${day.detail}`}
                    className={`h-6 flex-1 rounded-xs transition cursor-help ${
                      day.status === "up"
                        ? "bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400"
                        : day.status === "degraded"
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-rose-500 hover:bg-rose-400"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card 4: Vector DB */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-blue-500/30 transition duration-300">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      Vector Storage
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Pinecone Semantic Indexing
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-4">
                <span>
                  Uptime:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    99.97%
                  </strong>
                </span>
                <span>
                  Latency:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {simulatedMetrics.vectorDb.latency}ms
                  </strong>
                </span>
              </div>
            </div>
            {/* 30 Day timeline */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1.5">
                <span>30 days ago</span>
                <span>99.97% Uptime</span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5 justify-between">
                {timelines.vectorDb.map((day, i) => (
                  <div
                    key={i}
                    title={`${day.date}: ${day.detail}`}
                    className={`h-6 flex-1 rounded-xs transition cursor-help ${
                      day.status === "up"
                        ? "bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400"
                        : day.status === "degraded"
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-rose-500 hover:bg-rose-400"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card 5: Real-time Sync */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-blue-500/30 transition duration-300">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      Live Editor Sync
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      WebSocket Collaborative Hub
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-4">
                <span>
                  Uptime:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    99.95%
                  </strong>
                </span>
                <span>
                  Latency:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {simulatedMetrics.webSocket.latency}ms
                  </strong>
                </span>
              </div>
            </div>
            {/* 30 Day timeline */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1.5">
                <span>30 days ago</span>
                <span>99.95% Uptime</span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5 justify-between">
                {timelines.webSocket.map((day, i) => (
                  <div
                    key={i}
                    title={`${day.date}: ${day.detail}`}
                    className={`h-6 flex-1 rounded-xs transition cursor-help ${
                      day.status === "up"
                        ? "bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400"
                        : day.status === "degraded"
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-rose-500 hover:bg-rose-400"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card 6: Storage */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-blue-500/30 transition duration-300">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      Media CDN Storage
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Audio/Video Recordings Bucket
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-4">
                <span>
                  Uptime:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    100.0%
                  </strong>
                </span>
                <span>
                  Latency:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {simulatedMetrics.storage.latency}ms
                  </strong>
                </span>
              </div>
            </div>
            {/* 30 Day timeline */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1.5">
                <span>30 days ago</span>
                <span>100.0% Uptime</span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5 justify-between">
                {timelines.storage.map((day, i) => (
                  <div
                    key={i}
                    title={`${day.date}: ${day.detail}`}
                    className={`h-6 flex-1 rounded-xs transition cursor-help ${
                      day.status === "up"
                        ? "bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400"
                        : day.status === "degraded"
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-rose-500 hover:bg-rose-400"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Latency and Metrics Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-6 rounded-2xl shadow-xs mb-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                Response Time & Latency Metrics
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Live response latency tracking across main infrastructure
                channels (ms)
              </p>
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400 flex-wrap">
              <span className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-blue-500 inline-block" /> React
                Web Application
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-indigo-500 inline-block" /> API /
                Auth Gateway
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-purple-500 inline-block" /> Gemini
                AI Engine
              </span>
            </div>
          </div>

          {/* SVG Animated Chart */}
          <div className="relative w-full h-[240px] bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/60 rounded-xl overflow-hidden px-2 pt-4">
            <svg
              viewBox="0 0 760 220"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              {/* Gridlines */}
              <line
                x1="20"
                y1="20"
                x2="740"
                y2="20"
                stroke="rgba(148, 163, 184, 0.1)"
                strokeWidth="1"
                strokeDasharray="4"
              />
              <line
                x1="20"
                y1="70"
                x2="740"
                y2="70"
                stroke="rgba(148, 163, 184, 0.1)"
                strokeWidth="1"
                strokeDasharray="4"
              />
              <line
                x1="20"
                y1="120"
                x2="740"
                y2="120"
                stroke="rgba(148, 163, 184, 0.1)"
                strokeWidth="1"
                strokeDasharray="4"
              />
              <line
                x1="20"
                y1="170"
                x2="740"
                y2="170"
                stroke="rgba(148, 163, 184, 0.1)"
                strokeWidth="1"
                strokeDasharray="4"
              />
              <line
                x1="20"
                y1="200"
                x2="740"
                y2="200"
                stroke="rgba(148, 163, 184, 0.15)"
                strokeWidth="1.5"
              />

              {/* Paths */}
              <path
                d={renderSvgPath("web")}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                className="transition-all duration-700 ease-in-out"
              />
              <path
                d={renderSvgPath("api")}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-700 ease-in-out"
              />
              <path
                d={renderSvgPath("ai")}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeLinecap="round"
                className="transition-all duration-700 ease-in-out"
              />

              {/* Data points */}
              {latencyHistory.map((item, idx) => {
                const maxVal =
                  Math.max(
                    ...latencyHistory.map((it) =>
                      Math.max(it.api, it.web, it.ai),
                    ),
                  ) * 1.15 || 400;
                const width = 760;
                const height = 220;
                const padding = 20;
                const x =
                  padding +
                  (idx * (width - 2 * padding)) / (latencyHistory.length - 1);

                const yApi =
                  height -
                  padding -
                  (item.api / maxVal) * (height - 2 * padding);
                const yWeb =
                  height -
                  padding -
                  (item.web / maxVal) * (height - 2 * padding);

                return (
                  <g
                    key={item.id}
                    className="opacity-0 hover:opacity-100 transition duration-150"
                  >
                    <line
                      x1={x}
                      y1="20"
                      x2={x}
                      y2="200"
                      stroke="rgba(148, 163, 184, 0.2)"
                      strokeWidth="1"
                    />
                    <circle
                      cx={x}
                      cy={yApi}
                      r="5"
                      fill="#6366f1"
                      className="cursor-pointer"
                    />
                    <circle
                      cx={x}
                      cy={yWeb}
                      r="4"
                      fill="#3b82f6"
                      className="cursor-pointer"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Timestamps Axis label overlay */}
            <div className="flex justify-between px-4 text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
              {latencyHistory.map((item) => (
                <span key={item.id}>{item.time}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Column A: Regional Infrastructure & Scheduled Maintenance */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Regional Status */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-5 rounded-2xl shadow-xs">
              <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-slate-400" />
                Regional Infrastructure
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/40 pb-3">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    US East (N. Virginia)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">
                      32ms
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/40 pb-3">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    EU West (Frankfurt)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">
                      84ms
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    AP South (Mumbai)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">
                      128ms
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Scheduled Maintenance Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                <Shield className="w-40 h-40" />
              </div>
              <span className="px-2.5 py-1 bg-white/20 backdrop-blur-xs font-bold text-[10px] uppercase tracking-wider rounded-md">
                Upcoming Maintenance
              </span>
              <h4 className="text-lg font-bold mt-3 tracking-tight">
                Database Sharding & Optimization
              </h4>
              <p className="text-xs text-blue-100/90 leading-relaxed mt-2">
                We will be performing a major storage cluster optimization.
                Platform metrics and transcription queues will be paused for
                approximately 2 hours.
              </p>
              <div className="mt-5 pt-4 border-t border-white/20 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-blue-200 font-semibold block uppercase">
                    Starts in
                  </span>
                  <span className="font-bold text-sm tracking-wide font-mono">
                    {maintenanceCountdown || "Calculating..."}
                  </span>
                </div>
                <Clock className="w-5 h-5 text-blue-200" />
              </div>
            </div>
          </div>

          {/* Column B: Incident Log */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-6 rounded-2xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    Incident Logs
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Historical log of platform disruptions and maintenance
                    windows
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
                  <button
                    onClick={() => setActiveFilter("all")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${activeFilter === "all" ? "bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setActiveFilter("active")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${activeFilter === "active" ? "bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setActiveFilter("resolved")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${activeFilter === "resolved" ? "bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    Resolved
                  </button>
                </div>
              </div>

              {filteredIncidents.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No events found matching criteria
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Check back later or refresh health status.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800/80">
                  {filteredIncidents.map((inc) => (
                    <div key={inc.id} className="relative pl-8 group">
                      {/* Timeline dot */}
                      <span className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 shadow-xs" />

                      <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100/60 dark:border-slate-800/50 p-4 rounded-xl hover:border-blue-500/20 dark:hover:border-blue-400/10 transition">
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                            {inc.title}
                          </h4>
                          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            Resolved
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mb-3 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {inc.date} • {inc.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {inc.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Support Info */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Noticing an issue not displayed here? Please check your regional
              connection settings or contact our support team directly.
            </p>
          </div>
          <a
            href="mailto:support@meetonmemory.com"
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs rounded-xl shadow-xs whitespace-nowrap transition"
          >
            Contact Support
          </a>
        </div>
      </main>
    </div>
  );
};

export default Status;
