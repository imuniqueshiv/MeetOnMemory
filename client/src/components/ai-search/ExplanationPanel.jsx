import React, { useState } from "react";

/**
 * A single explanation line: a checkmark (or neutral dash if not
 * applicable/not matched) plus a label and an optional value.
 */
const CheckItem = ({ active, label, value }) => (
  <li className="flex items-center gap-2 text-sm">
    <span
      className={
        active
          ? "text-green-600 dark:text-green-400"
          : "text-gray-300 dark:text-gray-600"
      }
      aria-hidden="true"
    >
      {active ? "✓" : "–"}
    </span>
    <span
      className={
        active
          ? "text-gray-700 dark:text-gray-300"
          : "text-gray-400 dark:text-gray-600"
      }
    >
      {label}
      {value !== undefined && value !== null && value !== "" && (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {" "}
          {value}
        </span>
      )}
    </span>
  </li>
);

/**
 * FEATURE #270: Explainable AI Memory Retrieval.
 * An expandable "Why this result?" section shown under a search result,
 * summarizing the signals that led to its retrieval and ranking:
 * semantic similarity, vector search rank, knowledge-graph traversal,
 * related-entity matches, retrieval confidence, recency, and
 * organization relevance. Deliberately stays at this human-readable
 * level rather than exposing raw embeddings/internals.
 */
const ExplanationPanel = ({ explanation }) => {
  const [open, setOpen] = useState(false);

  if (!explanation) return null;

  const {
    semanticSimilarity,
    vectorRank,
    graphTraversal,
    relatedEntityMatch,
    confidence,
    recentlyAccessed,
    organizationRelevance,
  } = explanation;

  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
      >
        <span className="inline-block w-3">{open ? "▾" : "▸"}</span>
        Why this result?
      </button>

      {open && (
        <ul className="mt-2 space-y-1.5 pl-1">
          <CheckItem
            active={semanticSimilarity.matched}
            label="Semantic Similarity"
            value={
              semanticSimilarity.matched
                ? semanticSimilarity.score.toFixed(2)
                : undefined
            }
          />
          {vectorRank != null && (
            <CheckItem
              active
              label="Vector Search Ranking"
              value={`#${vectorRank}`}
            />
          )}
          <CheckItem
            active={graphTraversal.matched}
            label="Knowledge Graph Traversal"
            value={
              graphTraversal.matched
                ? `${graphTraversal.hops} hop${graphTraversal.hops > 1 ? "s" : ""} away`
                : undefined
            }
          />
          <CheckItem active={relatedEntityMatch} label="Related Entity Match" />
          <CheckItem
            active={recentlyAccessed.accessed}
            label="Recently Accessed"
          />
          <CheckItem
            active={confidence.score >= 50}
            label="Confidence"
            value={confidence.label}
          />
          {organizationRelevance && (
            <CheckItem
              active={organizationRelevance.matches}
              label="Organization Relevance"
            />
          )}
        </ul>
      )}
    </div>
  );
};

export default ExplanationPanel;
