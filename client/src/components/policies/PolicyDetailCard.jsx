import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  UserCircle,
  Tag,
  Sparkles,
  MessageSquare,
  History,
  Columns2,
  Download,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Share2,
  AlignLeft,
  Loader2,
} from "lucide-react";
import { StatusBadge, Pill, formatDate } from "./PolicyUtils";
import ShareModal from "../shared-links/ShareModal";
import { policyApi } from "../../services";
import { askAssistantAbout } from "../../utils/askAssistant.js";

export const PolicyDetailModal = ({
  policy: p,
  onClose,
  onDownload,
  onReanalyze,
  onCompare,
}) => {
  const navigate = useNavigate();
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const authorName = p?.uploadedBy?.name || "Unknown";
  const editorName = p?.lastEditedBy?.name;
  const hasAiContent =
    p.summary &&
    !p.summary.includes("unavailable") &&
    !p.summary.includes("failed");

  return (
    <div className="p-6">
      <div className="pr-8 mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
          <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
          {p.name}
        </h2>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
          <span>
            Version <Pill tone="indigo">v{p.version || "1.0"}</Pill>
          </span>
          <StatusBadge status={p.status || "ready"} />
          <span>Uploaded {formatDate(p.createdAt)}</span>
          <span className="flex items-center gap-1">
            <UserCircle className="w-4 h-4" /> {authorName}
          </span>
          {editorName && editorName !== authorName && (
            <span className="text-xs text-gray-400">
              Last edited by {editorName}
            </span>
          )}
        </div>
      </div>

      {p.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {p.keywords.map((kw, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100"
            >
              <Tag className="w-3 h-3" />#{kw}
            </span>
          ))}
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> AI Summary
        </h3>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
          {p.summary || "No summary available for this document."}
        </div>
        {!hasAiContent && (
          <button
            onClick={() => {
              onReanalyze(p._id);
              onClose();
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            <Sparkles className="w-3 h-3" /> Retry AI Analysis
          </button>
        )}
      </div>

      {p.key_changes?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" /> Key Changes
          </h3>
          <ul className="text-sm text-gray-600 list-disc ml-5 space-y-1">
            {p.key_changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {p.commitMsg && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-sm text-amber-800">
          <span className="font-medium">Commit:</span> {p.commitMsg}
        </div>
      )}

      {p.previousVersions?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
            <History className="w-4 h-4 text-purple-500" /> Previous Versions
          </h3>
          <ul className="space-y-2">
            {p.previousVersions.map((v, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm bg-gray-50 border rounded-lg px-3 py-2 gap-3"
              >
                <span className="text-gray-700 truncate">
                  <Pill tone="gray">v{v.version || "?"}</Pill>
                  <span className="ml-2 text-gray-500">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                  {v?.uploadedBy?.name && (
                    <span className="text-gray-400 ml-1">
                      · {v.uploadedBy.name}
                    </span>
                  )}
                  {v.commitMsg && (
                    <span className="text-gray-400 ml-1 italic">
                      · {v.commitMsg}
                    </span>
                  )}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="text-xs text-indigo-700 hover:underline flex items-center gap-1"
                    onClick={() => onCompare(v)}
                  >
                    <Columns2 className="w-3 h-3" /> Compare
                  </button>
                  <button
                    className="text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"
                    onClick={() => onDownload(v._id, v.name)}
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2 flex-wrap">
        <button
          onClick={() => onDownload(p._id, p.name)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Download className="w-4 h-4" /> Download
        </button>
        <button
          type="button"
          onClick={() =>
            askAssistantAbout(navigate, {
              type: "policy",
              refId: p._id,
              title: p.name || "Untitled Policy",
            })
          }
          className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 hover:bg-violet-100 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <MessageSquare className="w-4 h-4" /> Ask Assistant
        </button>
        <button
          onClick={onClose}
          className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Close
        </button>
        <button
          onClick={() => setShareModalOpen(true)}
          className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
      </div>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        resourceId={p._id}
        resourceType="Policy"
        title={p.name}
      />
    </div>
  );
};

export const HistoryModal = ({ policy: p, onDownload, onCompare }) => {
  const [expandedIdx, setExpandedIdx] = useState(null);

  return (
    <div className="p-6">
      <div className="pr-8 mb-5">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-purple-600" />
          Version History
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {p.name} · Current: <Pill tone="indigo">v{p.version || "1.0"}</Pill>
          <span className="ml-2">{formatDate(p.updatedAt || p.createdAt)}</span>
        </p>
      </div>

      <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-indigo-800">
              v{p.version || "1.0"}
            </span>
            <span className="text-xs text-indigo-600 ml-2">(current)</span>
            <span className="text-xs text-gray-500 ml-2">
              {formatDate(p.updatedAt || p.createdAt)}
            </span>
            {p.uploadedBy?.name && (
              <span className="text-xs text-gray-400 ml-2">
                · {p.uploadedBy.name}
              </span>
            )}
          </div>
          <button
            onClick={() => onDownload(p._id, p.name)}
            className="text-xs text-indigo-700 hover:underline flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
        {p.commitMsg && (
          <p className="text-xs text-indigo-700 mt-1 italic">{p.commitMsg}</p>
        )}
        {p.summary && (
          <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
            {p.summary}
          </p>
        )}
      </div>

      {p.previousVersions?.length > 0 ? (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {[...p.previousVersions].reverse().map((v, i) => {
            const isExpanded = expandedIdx === i;
            return (
              <div
                key={v._id || v.createdAt || i}
                className="border rounded-xl bg-gray-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">
                        v{v.version || "?"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(v.createdAt)}
                      </span>
                      {v.uploadedBy?.name && (
                        <span className="text-xs text-gray-400">
                          · {v.uploadedBy.name}
                        </span>
                      )}
                    </div>
                    {v.commitMsg && (
                      <p className="text-xs text-gray-500 mt-0.5 italic">
                        {v.commitMsg}
                      </p>
                    )}
                    {v.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.keywords.slice(0, 4).map((kw, ki) => (
                          <span
                            key={ki}
                            className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(v.summary || v.key_changes?.length > 0) && (
                      <button
                        onClick={() => setExpandedIdx(isExpanded ? null : i)}
                        className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-0.5"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      className="text-xs text-indigo-700 hover:underline flex items-center gap-1"
                      onClick={() => onCompare(v)}
                    >
                      <Columns2 className="w-3 h-3" /> Compare
                    </button>
                    <button
                      className="text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"
                      onClick={() => onDownload(v._id, v.name)}
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 bg-white">
                    {v.summary && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" /> AI
                          Summary
                        </p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {v.summary}
                        </p>
                      </div>
                    )}
                    {v.key_changes?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          Key Changes
                        </p>
                        <ul className="list-disc ml-4 text-xs text-gray-600 space-y-0.5">
                          {v.key_changes.map((c, ci) => (
                            <li key={ci}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No previous versions yet. Upload a new version to start tracking
          history.
        </div>
      )}
    </div>
  );
};

export const CompareModal = ({ pair, onClose }) => {
  const policy = pair?.newer;
  const versionOptions = useMemo(() => {
    if (!policy) return [];
    const previous = [...(policy.previousVersions || [])]
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map((v) => ({
        id: String(v._id),
        label: `v${v.version || "?"}`,
        createdAt: v.createdAt,
      }));
    return [
      ...previous,
      {
        id: "current",
        label: `v${policy.version || "?"} (current)`,
        createdAt: policy.updatedAt || policy.createdAt,
      },
    ];
  }, [policy]);

  const defaultFrom = pair?.older?._id
    ? String(pair.older._id)
    : versionOptions[0]?.id || "";
  const [fromRef, setFromRef] = useState(defaultFrom);
  const [toRef, setToRef] = useState("current");
  const [viewMode, setViewMode] = useState("side-by-side");
  const [activeTab, setActiveTab] = useState("diff");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    if (!policy?._id || !fromRef || !toRef || fromRef === toRef) {
      setComparison(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await policyApi.compareVersions(policy._id, fromRef, toRef);
        if (cancelled) return;
        if (res.data.success) {
          setComparison(res.data);
        } else {
          setComparison(null);
          setError(res.data.message || "Could not compare versions.");
        }
      } catch (err) {
        if (cancelled) return;
        setComparison(null);
        setError(
          err.response?.data?.message ||
            "Failed to load the version diff. Please try again.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [policy?._id, fromRef, toRef]);

  if (!policy?.previousVersions?.length) {
    return (
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Columns2 className="w-5 h-5 text-indigo-600" />
          Compare Versions
        </h3>
        <div className="mt-6 text-center py-10 text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Only one version exists for this policy. Upload a new version to
          enable comparison.
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const stats = comparison?.diff?.stats;
  const rows = comparison?.diff?.rows || [];

  return (
    <div className="p-6">
      <div className="pr-8 mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Columns2 className="w-5 h-5 text-indigo-600" />
          Policy Version Diff
        </h3>
        <p className="text-sm text-gray-500 mt-1 truncate">
          {policy?.name || "Policy"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-4">
        <label className="flex-1 text-xs font-semibold text-gray-600">
          From
          <select
            value={fromRef}
            onChange={(e) => setFromRef(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white"
          >
            {versionOptions.map((opt) => (
              <option key={opt.id} value={opt.id} disabled={opt.id === toRef}>
                {opt.label}
                {opt.createdAt ? ` · ${formatDate(opt.createdAt)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-xs font-semibold text-gray-600">
          To
          <select
            value={toRef}
            onChange={(e) => setToRef(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white"
          >
            {versionOptions.map((opt) => (
              <option key={opt.id} value={opt.id} disabled={opt.id === fromRef}>
                {opt.label}
                {opt.createdAt ? ` · ${formatDate(opt.createdAt)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg self-stretch lg:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("side-by-side")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
              viewMode === "side-by-side"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            aria-pressed={viewMode === "side-by-side"}
          >
            <Columns2 className="w-3.5 h-3.5" />
            Side-by-side
          </button>
          <button
            type="button"
            onClick={() => setViewMode("unified")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
              viewMode === "unified"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            aria-pressed={viewMode === "unified"}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            Unified
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 border-b border-gray-100">
        {[
          { id: "diff", label: "Document Diff" },
          { id: "summary", label: "AI Summary" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {stats && activeTab === "diff" && (
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            +{stats.added} added
          </span>
          <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
            −{stats.removed} removed
          </span>
          <span className="px-2 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
            {stats.unchanged} unchanged
          </span>
          {comparison?.diff?.truncated && (
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              Large document — showing first portion
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Comparing versions…
        </div>
      )}

      {!loading && error && (
        <div className="py-10 text-center text-sm text-rose-600 border border-rose-100 bg-rose-50/60 rounded-xl">
          {error}
        </div>
      )}

      {!loading && !error && fromRef === toRef && (
        <div className="py-10 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl">
          Select two different versions to compare.
        </div>
      )}

      {!loading && !error && comparison && activeTab === "diff" && (
        <>
          {!comparison.from?.textAvailable && !comparison.to?.textAvailable ? (
            <div className="py-10 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl">
              Extracted document text is unavailable for these versions. Check
              the AI Summary tab for metadata changes.
            </div>
          ) : viewMode === "unified" ? (
            <div className="max-h-[55vh] overflow-auto border border-gray-200 rounded-xl bg-white font-mono text-xs leading-5">
              {rows.map((row, idx) => {
                const isAdd = row.type === "add";
                const isRemove = row.type === "remove";
                return (
                  <div
                    key={idx}
                    className={`flex gap-2 px-2 py-0.5 border-b border-gray-50 ${
                      isAdd
                        ? "bg-emerald-50 text-emerald-900"
                        : isRemove
                          ? "bg-rose-50 text-rose-900"
                          : "text-gray-700"
                    }`}
                  >
                    <span className="w-10 shrink-0 text-right text-gray-400 select-none">
                      {row.leftLine ?? ""}
                    </span>
                    <span className="w-10 shrink-0 text-right text-gray-400 select-none">
                      {row.rightLine ?? ""}
                    </span>
                    <span className="w-4 shrink-0 font-bold">
                      {isAdd ? "+" : isRemove ? "−" : " "}
                    </span>
                    <span className="whitespace-pre-wrap break-all">
                      {isAdd ? row.right : row.left}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3 max-h-[55vh] overflow-hidden">
              {[
                {
                  title: `v${comparison.from?.version || "?"}`,
                  side: "left",
                },
                {
                  title: `v${comparison.to?.version || "?"}`,
                  side: "right",
                },
              ].map(({ title, side }) => (
                <div
                  key={side}
                  className="border border-gray-200 rounded-xl overflow-hidden flex flex-col min-h-0"
                >
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">
                    {title}
                  </div>
                  <div className="overflow-auto max-h-[50vh] font-mono text-xs leading-5">
                    {rows.map((row, idx) => {
                      const text = side === "left" ? row.left : row.right;
                      const lineNo =
                        side === "left" ? row.leftLine : row.rightLine;
                      if (text === null) {
                        return (
                          <div
                            key={idx}
                            className="px-2 py-0.5 bg-gray-50/80 text-transparent select-none border-b border-gray-50"
                          >
                            .
                          </div>
                        );
                      }
                      const highlight =
                        row.type === "remove" && side === "left"
                          ? "bg-rose-50 text-rose-900"
                          : row.type === "add" && side === "right"
                            ? "bg-emerald-50 text-emerald-900"
                            : "text-gray-700";
                      return (
                        <div
                          key={idx}
                          className={`flex gap-2 px-2 py-0.5 border-b border-gray-50 ${highlight}`}
                        >
                          <span className="w-8 shrink-0 text-right text-gray-400 select-none">
                            {lineNo}
                          </span>
                          <span className="whitespace-pre-wrap break-all">
                            {text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && comparison && activeTab === "summary" && (
        <div className="grid md:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto">
          {[
            { label: "From", v: comparison.from },
            { label: "To", v: comparison.to },
          ].map(({ label, v }) => (
            <div key={label} className="border rounded-xl p-4 bg-gray-50">
              <div className="mb-3">
                <h4 className="font-semibold text-gray-800">
                  {label} —{" "}
                  <Pill tone={label === "From" ? "gray" : "indigo"}>
                    v{v?.version || "?"}
                  </Pill>
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(v?.createdAt)}
                </p>
                {v?.commitMsg && (
                  <p className="text-xs italic text-gray-500 mt-0.5">
                    {v.commitMsg}
                  </p>
                )}
              </div>

              {v?.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {v.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-xs bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> AI Summary
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {v?.summary || "(No summary available for this version)"}
              </pre>

              {v?.key_changes?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    Key Changes
                  </p>
                  <ul className="list-disc ml-4 text-xs text-gray-600 space-y-0.5">
                    {v.key_changes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export const DeleteConfirmModal = ({ policy, onClose, onConfirm }) => (
  <div className="p-6">
    <div className="flex items-start gap-3 mb-4">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0">
        <Trash2 className="w-5 h-5 text-red-600" />
      </span>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Delete policy?</h3>
        <p className="text-sm text-gray-500 mt-1">
          You are about to permanently delete{" "}
          <strong className="text-gray-800">{policy.name}</strong>
          {policy.previousVersions?.length > 0 && (
            <span className="text-red-600">
              {" "}
              and all {policy.previousVersions.length} previous version
              {policy.previousVersions.length !== 1 ? "s" : ""}
            </span>
          )}
          . This action cannot be undone.
        </p>
      </div>
    </div>
    <div className="flex justify-end gap-2">
      <button
        onClick={onClose}
        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
      >
        Delete Permanently
      </button>
    </div>
  </div>
);
