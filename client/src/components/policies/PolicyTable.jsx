import React from "react";
import {
  FileText,
  History,
  Download,
  Eye,
  Trash2,
  UserCircle,
  Sparkles,
  Upload,
} from "lucide-react";
import { StatusBadge, Pill, formatRelative } from "./PolicyUtils";

const SkeletonRow = () => (
  <div className="px-6 py-4 animate-pulse flex gap-4 items-start border-b last:border-0">
    <div className="w-5 h-5 rounded bg-gray-200 mt-0.5 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-2/5" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
      <div className="flex gap-2 mt-1">
        <div className="h-5 bg-gray-100 rounded-full w-14" />
        <div className="h-5 bg-gray-100 rounded-full w-20" />
      </div>
    </div>
    <div className="w-20 h-4 bg-gray-200 rounded" />
    <div className="w-28 h-4 bg-gray-200 rounded" />
    <div className="flex gap-2">
      <div className="w-10 h-6 bg-gray-100 rounded" />
      <div className="w-16 h-6 bg-gray-100 rounded" />
    </div>
  </div>
);

const Empty = (props) => {
  const { icon: IconComponent, title, subtitle, action } = props;
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <IconComponent className="w-8 h-8 text-indigo-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      {subtitle && (
        <p className="text-gray-500 mt-2 max-w-sm text-sm leading-relaxed">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};

const ActionBtn = (props) => {
  const { onClick, icon: IconBtn, label, color = "gray" } = props;
  const colorMap = {
    blue: "hover:text-blue-600 hover:bg-blue-50",
    indigo: "hover:text-indigo-600 hover:bg-indigo-50",
    purple: "hover:text-purple-600 hover:bg-purple-50",
    red: "hover:text-red-600 hover:bg-red-50",
    gray: "hover:text-gray-900 hover:bg-gray-100",
  };
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg text-gray-500 transition ${colorMap[color] || colorMap.gray}`}
    >
      <IconBtn className="w-4 h-4" />
    </button>
  );
};

const PolicyRow = ({
  policy: p,
  onView,
  onHistory,
  onDownload,
  onDelete,
  onReanalyze,
  isAdmin,
}) => {
  const authorName = p?.uploadedBy?.name || p?.lastEditedBy?.name || "Unknown";
  const needsReanalysis =
    !p.summary ||
    p.summary.includes("unavailable") ||
    p.summary.includes("failed") ||
    p.status === "failed";

  return (
    <li className="px-4 sm:px-6 py-4 grid md:grid-cols-12 gap-3 items-start hover:bg-gray-50/70 transition-colors">
      <div className="md:col-span-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 shrink-0">
            <FileText className="w-4 h-4 text-indigo-500" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onView}
                className="text-sm font-semibold text-gray-900 hover:text-indigo-700 text-left leading-snug"
              >
                {p.name}
              </button>
              <StatusBadge status={p.status || "ready"} />
              {needsReanalysis && p.status !== "processing" && (
                <button
                  onClick={onReanalyze}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  title="Retry AI analysis"
                >
                  <Sparkles className="w-3 h-3" /> Retry AI
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Updated {formatRelative(p.updatedAt || p.createdAt)}
            </p>
            {p.keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {p.keywords.slice(0, 5).map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100"
                  >
                    #{tag}
                  </span>
                ))}
                {p.keywords.length > 5 && (
                  <span className="text-xs text-gray-400">
                    +{p.keywords.length - 5} more
                  </span>
                )}
              </div>
            )}
            {p.summary && !needsReanalysis && (
              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                {p.summary}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="md:col-span-2 flex items-center gap-2">
        <Pill tone="indigo">v{p.version || "1.0"}</Pill>
        {p.previousVersions?.length > 0 && (
          <button
            className="text-xs text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-0.5"
            onClick={onHistory}
          >
            <History className="w-3 h-3" />
            {p.previousVersions.length}
          </button>
        )}
      </div>

      <div className="md:col-span-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <UserCircle className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="truncate">{authorName}</span>
        </div>
        {p.commitMsg && (
          <p
            className="text-xs text-gray-400 mt-0.5 truncate"
            title={p.commitMsg}
          >
            {p.commitMsg}
          </p>
        )}
      </div>

      <div className="md:col-span-2 flex md:justify-end gap-1.5 flex-wrap">
        <ActionBtn onClick={onView} icon={Eye} label="View" color="blue" />
        <ActionBtn
          onClick={onDownload}
          icon={Download}
          label="Download"
          color="indigo"
        />
        <ActionBtn
          onClick={onHistory}
          icon={History}
          label="History"
          color="purple"
        />
        {isAdmin && (
          <ActionBtn
            onClick={onDelete}
            icon={Trash2}
            label="Delete"
            color="red"
          />
        )}
      </div>
    </li>
  );
};

const PolicyTable = React.memo(
  ({
    filtered,
    loading,
    query,
    isAdmin,
    scrollToUpload,
    setSelectedPolicy,
    setShowHistoryFor,
    handleDownload,
    setConfirmDelete,
    handleReanalyze,
  }) => {
    return (
      <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs uppercase tracking-wider text-gray-400 bg-gray-50 border-b font-medium">
          <div className="col-span-5">Document</div>
          <div className="col-span-2">Version</div>
          <div className="col-span-3">Uploaded by</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : filtered.length === 0 ? (
          <Empty
            icon={FileText}
            title={query ? "No matching policies" : "No policy documents yet"}
            subtitle={
              query
                ? `No policies match "${query}". Try a different search term.`
                : "Upload your first policy to get AI summaries, keywords, and full version tracking."
            }
            action={
              !query ? (
                <button
                  onClick={scrollToUpload}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                >
                  <Upload className="w-4 h-4" /> Upload a Policy
                </button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <PolicyRow
                key={p._id}
                policy={p}
                onView={() => setSelectedPolicy(p)}
                onHistory={() => setShowHistoryFor(p)}
                onDownload={() => handleDownload(p._id, p.name)}
                onDelete={() => setConfirmDelete(p)}
                onReanalyze={() => handleReanalyze(p._id)}
                isAdmin={isAdmin}
              />
            ))}
          </ul>
        )}
      </div>
    );
  },
);

export default PolicyTable;
