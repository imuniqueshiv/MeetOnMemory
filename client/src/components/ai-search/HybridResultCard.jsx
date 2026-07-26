import React from "react";
import ExplanationPanel from "./ExplanationPanel.jsx";

const TYPE_LABELS = {
  meeting: "Meeting",
  decision: "Decision",
  actionItem: "Action Item",
};

const TYPE_COLORS = {
  meeting: "bg-blue-100 text-blue-700",
  decision: "bg-purple-100 text-purple-700",
  actionItem: "bg-amber-100 text-amber-700",
};

const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const ScoreBar = ({ label, value, colorClass }) => (
  <div className="flex items-center gap-2 text-xs text-gray-500">
    <span className="w-16 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }}
      />
    </div>
    <span className="w-10 text-right">{Math.round(value * 100)}%</span>
  </div>
);

/**
 * Renders a single result from the hybrid retrieval pipeline
 * (POST /api/search/hybrid). Unlike the standard SearchResultCard, this
 * surfaces *why* a result was returned: matched semantically, discovered
 * through knowledge-graph traversal, or both.
 */
const HybridResultCard = ({ result, onOpenMeeting }) => {
  const {
    type,
    title,
    summary,
    semanticScore = 0,
    graphScore = 0,
    finalScore = 0,
    hops = 0,
    sourceMeeting,
    explanation,
  } = result;

  const foundVia =
    semanticScore > 0 && hops > 0
      ? "semantic + graph"
      : semanticScore > 0
        ? "semantic match"
        : "graph connection";

  return (
    <div className="group p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[type] || "bg-gray-100 text-gray-700"}`}
        >
          {TYPE_LABELS[type] || type}
        </span>
        <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-50 text-gray-600 border border-gray-200">
          {Math.round(finalScore * 100)}% overall
        </span>
        {hops > 0 && (
          <span
            className="text-xs px-2 py-1 rounded-full font-medium bg-indigo-50 text-indigo-700"
            title="Discovered via the knowledge graph, not a direct semantic match"
          >
            🔗 {hops} hop{hops > 1 ? "s" : ""} away
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900">
        {title || "Untitled"}
      </h3>

      {summary && (
        <p className="text-gray-700 text-sm mt-2 leading-relaxed line-clamp-3">
          {summary}
        </p>
      )}

      <div className="mt-4 space-y-1.5">
        <ScoreBar
          label="Semantic"
          value={semanticScore}
          colorClass="bg-blue-500"
        />
        <ScoreBar label="Graph" value={graphScore} colorClass="bg-indigo-500" />
      </div>

      <ExplanationPanel explanation={explanation} />

      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span title="How this result was found">🧭 {foundVia}</span>
          {sourceMeeting && (
            <span>
              📅 {formatDate(sourceMeeting.createdAt) || "Unknown date"}
            </span>
          )}
        </div>
        {(type === "meeting" || sourceMeeting) && (
          <button
            onClick={() =>
              onOpenMeeting(type === "meeting" ? result.id : sourceMeeting.id)
            }
            className="text-blue-600 font-medium hover:underline"
          >
            Open meeting
          </button>
        )}
      </div>
    </div>
  );
};

export default HybridResultCard;
