import React from "react";

/**
 * Lets the user switch between the standard meeting-only semantic search
 * and the hybrid (semantic + knowledge-graph) retrieval pipeline, and,
 * when hybrid mode is active, tune the relative weighting between the two
 * signals. Purely additive UI - the standard mode's behavior is untouched.
 */
const HybridSearchToggle = ({ mode, setMode, weights, setWeights }) => {
  return (
    <div className="w-full flex flex-col items-center gap-3 mt-4">
      <div className="inline-flex bg-gray-100 rounded-full p-1 text-sm">
        <button
          onClick={() => setMode("standard")}
          className={`px-4 py-1.5 rounded-full font-medium transition ${
            mode === "standard"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Standard
        </button>
        <button
          onClick={() => setMode("hybrid")}
          className={`px-4 py-1.5 rounded-full font-medium transition ${
            mode === "hybrid"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
          title="Combines semantic vector search with knowledge-graph traversal across decisions and action items"
        >
          🔀 Hybrid
        </button>
      </div>

      {mode === "hybrid" && (
        <div className="w-full max-w-md flex items-center gap-3 text-xs text-gray-500">
          <span className="shrink-0">Semantic</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(weights.semanticWeight * 100)}
            onChange={(e) => {
              const semanticWeight = Number(e.target.value) / 100;
              setWeights({
                semanticWeight,
                graphWeight: 1 - semanticWeight,
              });
            }}
            className="flex-1 accent-blue-600"
          />
          <span className="shrink-0">Graph</span>
          <span className="w-20 text-right shrink-0 tabular-nums">
            {Math.round(weights.semanticWeight * 100)}/
            {Math.round(weights.graphWeight * 100)}
          </span>
        </div>
      )}
    </div>
  );
};

export default HybridSearchToggle;
