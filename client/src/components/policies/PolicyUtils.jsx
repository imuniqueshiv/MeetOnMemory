/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { Upload, Cpu, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const formatDate = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const formatRelative = (d) => {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
};

export const StatusBadge = ({ status }) => {
  const map = {
    uploading: {
      icon: Upload,
      label: "Uploading",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    },
    processing: {
      icon: Cpu,
      label: "Processing AI",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    ready: {
      icon: CheckCircle2,
      label: "Ready",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      cls: "bg-red-50 text-red-700 border-red-200",
    },
  };
  const cfg = map[status] || map.ready;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

export const Pill = ({ children, tone = "indigo" }) => {
  const toneMap = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneMap[tone] || toneMap.indigo}`}
    >
      {children}
    </span>
  );
};

export const ProgressBar = ({ progress, stage }) => {
  const stageLabels = {
    idle: "",
    uploading: `Uploading… ${progress}%`,
    processing: "Generating AI summary…",
    done: "Complete!",
    error: "Upload failed",
  };
  if (stage === "idle") return null;

  const barColor =
    stage === "done"
      ? "bg-emerald-500"
      : stage === "error"
        ? "bg-red-500"
        : stage === "processing"
          ? "bg-amber-400"
          : "bg-blue-500";

  const displayProgress =
    stage === "processing"
      ? 90
      : stage === "done"
        ? 100
        : stage === "error"
          ? 100
          : progress;

  return (
    <div className="mt-4 space-y-1">
      <div className="flex items-center justify-between text-xs font-medium text-gray-600">
        <span className="flex items-center gap-1">
          {stage === "processing" && (
            <Loader2 className="w-3 h-3 animate-spin" />
          )}
          {stage === "done" && (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          )}
          {stage === "error" && <XCircle className="w-3 h-3 text-red-500" />}
          {stageLabels[stage]}
        </span>
        <span>{displayProgress}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor} ${stage === "processing" ? "animate-pulse" : ""}`}
          style={{ width: `${displayProgress}%` }}
        />
      </div>
    </div>
  );
};

export const Modal = ({ children, onClose, maxWidth = "max-w-3xl" }) => (
  <div
    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start z-50 p-4 pt-16 overflow-y-auto"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      className={`bg-white w-full ${maxWidth} rounded-2xl shadow-2xl relative`}
    >
      <button
        onClick={onClose}
        aria-label="Close modal"
        className="absolute top-4 right-4 z-10 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
      >
        <span className="sr-only">Close</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      {children}
    </div>
  </div>
);
