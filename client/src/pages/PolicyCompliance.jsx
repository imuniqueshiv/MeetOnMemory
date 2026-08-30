import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import * as policyComplianceApi from "../services/policyComplianceApi";
import { useEffect as useEffectCallback } from "react";import { toast } from "react-toastify";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileArchive,
  FileText,
  Filter,
  Layers,
  Loader2,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  X,
  XCircle,
} from "lucide-react";

const CLASSIFICATION_STYLES = {
  potential_conflict: {
    label: "Potential Conflict",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-900/60",
    icon: ShieldAlert,
  },
  aligned: {
    label: "Aligned",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    textColor: "text-emerald-700 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-900/60",
    icon: ShieldCheck,
  },
  references: {
    label: "References",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-900/60",
    icon: FileText,
  },
  unrelated: {
    label: "Unrelated",
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-200 dark:border-slate-700",
    icon: ShieldQuestion,
  },
  unclassified: {
    label: "Needs Retry",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    textColor: "text-amber-700 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-900/60",
    icon: ShieldQuestion,
  },
};

const CLASSIFICATION_TABS = [
  { value: "all", label: "All Classifications", icon: Shield },
  {
    value: "potential_conflict",
    label: "Potential Conflicts",
    icon: ShieldAlert,
  },
  { value: "aligned", label: "Aligned", icon: ShieldCheck },
  { value: "references", label: "References", icon: FileText },
  { value: "unrelated", label: "Unrelated", icon: ShieldQuestion },
  { value: "unclassified", label: "Needs Retry", icon: ShieldQuestion },
];

const STATUS_TABS = [
  { value: "unresolved", label: "Unresolved" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const getInitialFilter = (params, key, fallback) => {
  const value = params.get(key);
  return value || fallback;
};

const downloadResponseBlob = (response, fallbackName) => {
  const contentDisposition = response.headers?.["content-disposition"] || "";
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const blob =
    response.data instanceof Blob ? response.data : new Blob([response.data]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const PolicyCompliance = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [flags, setFlags] = useState([]);
const [error, setError] = useState(null);
const [loading, setLoading] = useState(false);
const [retryQueuedIds, setRetryQueuedIds] = useState(() => new Set());
const [workerStatus, setWorkerStatus] = useState(null);
const [workerLoading, setWorkerLoading] = useState(true);  const [statusTab, setStatusTab] = useState(() =>
    getInitialFilter(searchParams, "status", "unresolved"),
  );
  const [classificationTab, setClassificationTab] = useState(() =>
    getInitialFilter(searchParams, "classification", "all"),
  );
  const [actioningId, setActioningId] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [selectedDecisionId, setSelectedDecisionId] = useState(null);
  const [decisionDetails, setDecisionDetails] = useState(null);
  const [loadingDecisionDetails, setLoadingDecisionDetails] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [policyDetails, setPolicyDetails] = useState(null);
  const [loadingPolicyDetails, setLoadingPolicyDetails] = useState(false);
  const [deepLinkVersion, setDeepLinkVersion] = useState(null);
  const [deepLinkPolicyId, setDeepLinkPolicyId] = useState(null);
  const [loadingDeepLink, setLoadingDeepLink] = useState(false);

  const fetchFlags = useCallback(async (status, classification) => {
    try {
      setLoading(true);
      setError(null);
      const res = await policyComplianceApi.getFlags(status, classification);
      if (res.data?.success) setFlags(res.data.flags || []);
      else setError(res.data?.message || "Failed to load compliance flags");
    } catch (err) {
      console.error("Error fetching compliance flags:", err);
      setError("Unable to fetch compliance flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags(statusTab, classificationTab);
  }, [statusTab, classificationTab, fetchFlags]);
 // Check policy compliance worker status on component mount
  useEffect(() => {
    const checkWorkerStatus = async () => {
      try {
        setWorkerLoading(true);
        const res = await policyComplianceApi.getWorkerStatus();
        if (res.status === 200) {
          setWorkerStatus(res.data?.data || null);
        }
      } catch (err) {
        console.error("Error checking worker status:", err);
        // Don't fail the page if status check fails; just don't display status
      } finally {
        setWorkerLoading(false);
      }
    };

    checkWorkerStatus();
  }, []);
  useEffect(() => {
    const policyId = searchParams.get("policyId");
    const version = searchParams.get("version");
    if (!policyId || !version) {
      setDeepLinkPolicyId(null);
      setDeepLinkVersion(null);
      return;
    }

    let cancelled = false;
    setLoadingDeepLink(true);
    policyComplianceApi
      .getPolicyVersion(policyId, version)
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setDeepLinkPolicyId(policyId);
          setDeepLinkVersion(res.data.data?.version || null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          toast.error(
            err.response?.data?.message || "Policy version could not be loaded",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingDeepLink(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all" || (key === "status" && value === "unresolved"))
      next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const handleStatusChange = (value) => {
    setStatusTab(value);
    updateFilter("status", value);
  };

  const handleClassificationChange = (value) => {
    setClassificationTab(value);
    updateFilter("classification", value);
  };

  const handleOpenDecisionDetails = async (decisionId) => {
    if (!decisionId) return;
    try {
      setSelectedDecisionId(decisionId);
      setLoadingDecisionDetails(true);
      setDecisionDetails(null);
      const res = await policyComplianceApi.getDecisionCompliance(decisionId);
      if (res.data?.success) setDecisionDetails(res.data.data);
      else
        toast.error(
          res.data?.message || "Failed to load decision compliance details",
        );
    } catch (err) {
      console.error("Error fetching decision compliance:", err);
      toast.error("Failed to load decision details");
    } finally {
      setLoadingDecisionDetails(false);
    }
  };

  const handleOpenPolicyDetails = async (policyId) => {
    if (!policyId) return;
    try {
      setSelectedPolicyId(policyId);
      setLoadingPolicyDetails(true);
      setPolicyDetails(null);
      const res = await policyComplianceApi.getPolicyRelatedDecisions(policyId);
      if (res.data?.success) setPolicyDetails(res.data.data);
      else
        toast.error(
          res.data?.message || "Failed to load policy related decisions",
        );
    } catch (err) {
      console.error("Error fetching policy related decisions:", err);
      toast.error("Failed to load policy details");
    } finally {
      setLoadingPolicyDetails(false);
    }
  };

  const handleExport = async (flag, format = "zip") => {
    try {
      setExportingId(flag._id);
      const response = await policyComplianceApi.exportEvidence(
        flag._id,
        format,
      );
      downloadResponseBlob(response, `policy-compliance-${flag._id}.${format}`);
      toast.success(`Evidence ${format.toUpperCase()} downloaded.`);
    } catch (err) {
      console.error("Evidence export failed:", err);
      toast.error(
        err.response?.data?.message ||
          "Evidence export failed. Please try again.",
      );
    } finally {
      setExportingId(null);
    }
  };

  const handleReview = async (flagId, status) => {
    try {
      setActioningId(flagId);
      const res = await policyComplianceApi.updateFlagStatus(flagId, status);
      if (res.data?.success) {
        toast.success(
          status === "acknowledged"
            ? "Flag acknowledged."
            : status === "dismissed"
              ? "Flag dismissed."
              : "Flag reopened.",
        );
        setFlags((prev) =>
          statusTab === "all"
            ? prev.map((f) => (f._id === flagId ? { ...f, status } : f))
            : prev.filter((f) => f._id !== flagId),
        );
      } else toast.error(res.data?.message || "Failed to update flag");
    } catch (err) {
      console.error("Error updating flag:", err);
      toast.error("Failed to update flag");
    } finally {
      setActioningId(null);
    }
  };

  const handleRetry = async (flagId) => {
    if (!flagId || retryQueuedIds.has(flagId)) return;
    try {
      const res = await policyComplianceApi.reEvaluate(flagId);
      if (res.data?.success) {
        setRetryQueuedIds((prev) => new Set(prev).add(flagId));
        toast.success("Re-evaluation queued.");
      } else {
        const msg = res.data?.message || "Failed to queue re-evaluation";
        // Show more contextual error for worker unavailable
        if (res.status === 503) {
          toast.error(msg);
          setWorkerStatus({ workerActive: false, message: msg });
        } else {
          toast.error(msg);
        }
      }
    } catch (err) {
      console.error("Error queueing re-evaluation:", err);
      // Check if it's a 503 worker unavailable error
      if (err.response?.status === 503) {
        toast.error(
          err.response?.data?.message ||
            "Policy compliance worker is temporarily unavailable",
        );
      } else {
        toast.error("Failed to queue policy re-evaluation");
      }
    }  };

  const countsByClassification = useMemo(() => {
    const counts = {
      all: flags.length,
      potential_conflict: 0,
      aligned: 0,
      references: 0,
      unrelated: 0,
      unclassified: 0,
    };
    flags.forEach((flag) => {
      if (counts[flag.classification] !== undefined)
        counts[flag.classification] += 1;
    });
    return counts;
  }, [flags]);

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />{" "}
              Policy Compliance
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review compliance decisions, export audit evidence, and open the
              exact policy version that was matched.
            </p>
          </div>
          <button
            onClick={() => navigate("/policies")}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800/60"
          >
            <FileText className="w-4 h-4" /> Manage Policies{" "}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {deepLinkPolicyId && (
          <section
            className="mb-6 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  Policy version deep-link
                </p>
                {loadingDeepLink ? (
                  <p className="mt-2 text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading matched
                    version...
                  </p>
                ) : deepLinkVersion ? (
                  <>
                    <h2 className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {deepLinkVersion.name || "Policy"} · v
                      {deepLinkVersion.version}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {deepLinkVersion.summary ||
                        "No summary recorded for this version."}
                    </p>
                    {deepLinkVersion.fileUrl && (
                      <a
                        href={deepLinkVersion.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Open policy document{" "}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </>
                ) : null}
              </div>
              <button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete("policyId");
                  next.delete("version");
                  setSearchParams(next, { replace: true });
                }}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close policy version deep-link"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleStatusChange(tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${statusTab === tab.value ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-2 items-center bg-slate-100/70 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 ml-1 mr-2">
            <Filter className="w-3.5 h-3.5" /> Classification:
          </span>
          {CLASSIFICATION_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => handleClassificationChange(tab.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${classificationTab === tab.value ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700" : "text-slate-600 dark:text-slate-400"}`}
              >
                <Icon className="w-3.5 h-3.5" /> {tab.label}
                {classificationTab === "all" && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px]">
                    {countsByClassification[tab.value]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading compliance
            flags...
          </div>
        )}
        {/* Worker status banner */}
        {!workerLoading && workerStatus && !workerStatus.workerActive && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-semibold">
              ⚠️ Policy Compliance Worker Unavailable
            </p>
            <p className="text-yellow-700 text-sm mt-2">
              {workerStatus.message}
            </p>
            {workerStatus.jobCounts?.waiting > 0 && (
              <p className="text-yellow-700 text-xs mt-1">
                ({workerStatus.jobCounts.waiting} re-evaluation(s) queued for
                processing)
              </p>
            )}
          </div>
        )}

        {!loading && error && (
          <p className="text-red-500 text-sm py-8 text-center">{error}</p>
        )}        {!loading && !error && flags.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
            No compliance records found.
          </div>
        )}

        <div className="space-y-4">
          {flags.map((flag) => {
            const style =
              CLASSIFICATION_STYLES[flag.classification] ||
              CLASSIFICATION_STYLES.unrelated;
            const Icon = style.icon;
            const decisionObj = flag.decisionId;
            const policyObj = flag.policyId;
            const policyVersion =
              flag.policyVersion || policyObj?.version || "1.0";
            const deepLink = `/policy-compliance?policyId=${encodeURIComponent(policyObj?._id || "")}&version=${encodeURIComponent(policyVersion)}&status=${encodeURIComponent(statusTab)}&classification=${encodeURIComponent(classificationTab)}`;

            return (
              <article
                key={flag._id}
                className={`rounded-xl border p-4 bg-white dark:bg-slate-900/50 ${style.borderColor}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${style.bgColor} ${style.textColor}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {style.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {Math.round((flag.similarityScore || 0) * 100)}% match
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {decisionObj?.text || "Decision unavailable"}
                      </p>
                      {decisionObj?._id && (
                        <button
                          onClick={() =>
                            handleOpenDecisionDetails(decisionObj._id)
                          }
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <FileText className="w-3.5 h-3.5" />
                        {policyObj?.name || "Policy unavailable"} · v
                        {policyVersion}
                      </div>
                      {policyObj?._id && (
                        <button
                          onClick={() => handleOpenPolicyDetails(policyObj._id)}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                        >
                          <Layers className="w-3.5 h-3.5" /> Related Decisions
                        </button>
                      )}
                      {policyObj?._id && (
                        <button
                          onClick={() => {
                            const next = new URLSearchParams(searchParams);
                            next.set("policyId", policyObj._id);
                            next.set("version", policyVersion);
                            setSearchParams(next, { replace: true });
                          }}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Version link
                        </button>
                      )}
                    </div>
                    {flag.reasoning && (
                      <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">
                        {flag.reasoning}
                      </p>
                    )}
                    {flag.sourceMeetingId && (
                      <button
                        onClick={() =>
                          navigate(`/meeting/${flag.sourceMeetingId._id}`)
                        }
                        className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {flag.sourceMeetingId.title}
                      </button>
                    )}
                    <p className="mt-2 text-[11px] text-slate-400 break-all">
                      Durable link: {window.location.origin}
                      {deepLink}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      disabled={exportingId === flag._id}
                      onClick={() => handleExport(flag, "zip")}
                      className="inline-flex items-center justify-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                    >
                      {exportingId === flag._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileArchive className="w-3.5 h-3.5" />
                      )}{" "}
                      {exportingId === flag._id ? "Exporting..." : "Export ZIP"}
                    </button>
                    <button
                      disabled={exportingId === flag._id}
                      onClick={() => handleExport(flag, "pdf")}
                      className="inline-flex items-center justify-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5" /> Export PDF
                    </button>
                    {flag.classification === "unclassified" && (
                      <button
                        disabled={retryQueuedIds.has(flag._id)}
                        onClick={() => handleRetry(flag._id)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {retryQueuedIds.has(flag._id) ? "Queued" : "Retry"}
                      </button>
                    )}
                    {flag.status !== "acknowledged" && (
                      <button
                        disabled={actioningId === flag._id}
                        onClick={() => handleReview(flag._id, "acknowledged")}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Acknowledge
                      </button>
                    )}
                    {flag.status !== "dismissed" && (
                      <button
                        disabled={actioningId === flag._id}
                        onClick={() => handleReview(flag._id, "dismissed")}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
                    )}
                    {flag.status !== "unresolved" && (
                      <button
                        disabled={actioningId === flag._id}
                        onClick={() => handleReview(flag._id, "unresolved")}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {selectedDecisionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => {
                setSelectedDecisionId(null);
                setDecisionDetails(null);
              }}
              className="absolute top-4 right-4 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-indigo-600" />
              Decision Compliance Breakdown
            </h2>
            {loadingDecisionDetails && (
              <div className="flex justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            )}
            {!loadingDecisionDetails && decisionDetails && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {decisionDetails.decision?.text}
                </p>
                {(decisionDetails.compliance || []).map((rec) => (
                  <div key={rec._id} className="p-3 rounded-lg border">
                    <p className="text-xs font-bold">
                      {rec.policyId?.name} (v{rec.policyId?.version || "1.0"})
                    </p>
                    <p className="text-xs text-slate-500">{rec.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPolicyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => {
                setSelectedPolicyId(null);
                setPolicyDetails(null);
              }}
              className="absolute top-4 right-4 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-indigo-600" />
              Policy Reverse-Lookup
            </h2>
            {loadingPolicyDetails && (
              <div className="flex justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            )}
            {!loadingPolicyDetails && policyDetails && (
              <div className="space-y-3">
                <p className="text-sm font-bold">
                  {policyDetails.policy?.name} (v
                  {policyDetails.policy?.version || "1.0"})
                </p>
                {(policyDetails.relatedDecisions || []).map((rec) => (
                  <div key={rec._id} className="p-3 rounded-lg border">
                    <p className="text-xs font-medium">
                      {rec.decisionId?.text || "Decision text unavailable"}
                    </p>
                    {rec.sourceMeetingId && (
                      <button
                        onClick={() =>
                          navigate(`/meeting/${rec.sourceMeetingId._id}`)
                        }
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {rec.sourceMeetingId.title}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyCompliance;
