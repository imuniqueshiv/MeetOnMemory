import React from "react";
import ExplanationPanel from "./ExplanationPanel.jsx";

const SearchResultCard = ({
  result,
  onViewDetails,
  onOpenMeeting,
  onCopySummary,
}) => {
  const getResultTypeLabel = (type) => {
    switch (type) {
      case "meeting":
        return "Meeting";
      case "policy":
        return "Policy";
      case "summary":
        return "AI Summary";
      default:
        return "Meeting";
    }
  };

  const getResultTypeColor = (type) => {
    switch (type) {
      case "meeting":
        return "bg-blue-100 text-blue-700";
      case "policy":
        return "bg-purple-100 text-purple-700";
      case "summary":
        return "bg-green-100 text-green-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const formatDate = (date) => {
    if (!date) return "Unknown date";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSimilarityColor = (score) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-blue-600";
    if (score >= 0.4) return "text-yellow-600";
    return "text-gray-600";
  };

  return (
    <div className="group p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${getResultTypeColor(result.resultType)}`}
            >
              {getResultTypeLabel(result.resultType)}
            </span>
            {result.similarityScore && (
              <span
                className={`text-xs font-medium ${getSimilarityColor(result.similarityScore)}`}
              >
                {Math.round(result.similarityScore * 100)}% match
              </span>
            )}
          </div>
          <h3
            className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition cursor-pointer"
            onClick={() => onViewDetails(result)}
          >
            {result.title || "Untitled Meeting"}
          </h3>
        </div>
      </div>

      <p className="text-gray-700 text-sm mt-2 leading-relaxed line-clamp-3">
        {result.summary ||
          result.transcript?.slice(0, 200) ||
          "No summary available."}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        {result.tags &&
          result.tags.length > 0 &&
          result.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs"
            >
              #{tag}
            </span>
          ))}
      </div>

      <ExplanationPanel explanation={result.explanation} />

      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          📅 {formatDate(result.createdAt)}
          {result.organization && (
            <span className="ml-3">🏢 {result.organization}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onViewDetails(result)}
            className="text-sm text-blue-600 font-medium hover:underline"
          >
            View Details
          </button>
          {result.resultType === "meeting" && (
            <button
              onClick={() => onOpenMeeting(result)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Open Meeting
            </button>
          )}
          <button
            onClick={() => onCopySummary(result)}
            className="text-sm text-gray-600 hover:text-gray-800"
            title="Copy summary"
          >
            📋
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;
