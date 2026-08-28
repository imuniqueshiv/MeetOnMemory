import React, { useMemo, useState } from "react";

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

const MatchModeBadge = ({ mode }) => (
  <span
    className={
      mode === "exact"
        ? "text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
    }
  >
    {mode === "exact" ? "Exact match" : "Semantic match"}
  </span>
);

const HighlightedSnippet = ({ text, match }) => {
  const parts = useMemo(() => {
    if (!text || !match) return [text || ""];
    const regex = new RegExp(
      `(${match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "ig",
    );
    return text.split(regex);
  }, [text, match]);

  return (
    <>
      {parts.map((part, index) =>
        part.toLocaleLowerCase() === match?.toLocaleLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded bg-yellow-100 px-0.5 text-yellow-900"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

/**
 * FEATURE #2173: Meeting Search Explainability Panel.
 *
 * Keeps the original compact retrieval signals while adding:
 * - exact vs semantic match badges
 * - transcript evidence with safe client-side highlighting
 * - topic/decision/participant/tag evidence
 * - a direct link back to the authorized meeting context
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
    searchEvidence,
  } = explanation;

  const modes = searchEvidence?.matchModes || [];
  const evidence = searchEvidence?.evidence || [];
  const transcriptSnippets = searchEvidence?.transcriptSnippets || [];

  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="search-explanation-details"
        className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
      >
        <span className="inline-block w-3">{open ? "▾" : "▸"}</span>
        Why this result?
        {modes.length > 0 && (
          <span className="ml-2 flex items-center gap-1">
            {modes.map((mode) => (
              <MatchModeBadge key={mode} mode={mode} />
            ))}
          </span>
        )}
      </button>

      {open && (
        <div id="search-explanation-details" className="mt-3 space-y-3">
          <ul className="space-y-1.5 pl-1">
            <CheckItem
              active={semanticSimilarity?.matched}
              label="Semantic Similarity"
              value={
                semanticSimilarity?.matched
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
              active={graphTraversal?.matched}
              label="Knowledge Graph Traversal"
              value={
                graphTraversal?.matched
                  ? `${graphTraversal.hops} hop${graphTraversal.hops > 1 ? "s" : ""} away`
                  : undefined
              }
            />
            <CheckItem
              active={relatedEntityMatch}
              label="Related Entity Match"
            />
            <CheckItem
              active={recentlyAccessed?.accessed}
              label="Recently Accessed"
            />
            <CheckItem
              active={(confidence?.score || 0) >= 50}
              label="Confidence"
              value={confidence?.label}
            />
            {organizationRelevance && (
              <CheckItem
                active={organizationRelevance.matches}
                label="Organization Relevance"
              />
            )}
          </ul>

          {evidence.length > 0 && (
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Matching evidence
              </h4>
              <div className="space-y-2">
                {evidence.map((item, index) => (
                  <div
                    key={`${item.field}-${item.kind}-${index}`}
                    className="text-xs"
                  >
                    <div className="font-medium text-gray-700 dark:text-gray-300">
                      {item.label}
                    </div>
                    {item.kind === "transcript" ? (
                      <p className="mt-1 leading-relaxed text-gray-600 dark:text-gray-400">
                        <HighlightedSnippet
                          text={item.text}
                          match={item.match}
                        />
                      </p>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(item.values || [item.match])
                          .filter(Boolean)
                          .map((value) => (
                            <span
                              key={value}
                              className="rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1 text-gray-600 dark:text-gray-300"
                            >
                              {value}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {transcriptSnippets.length > 0 && (
            <div className="rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 p-3">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                Transcript evidence
              </div>
              {transcriptSnippets.map((snippet, index) => (
                <p
                  key={`${snippet.startOffset}-${index}`}
                  className="mt-1 text-xs leading-relaxed text-gray-700 dark:text-gray-300"
                >
                  <HighlightedSnippet
                    text={snippet.text}
                    match={snippet.match}
                  />
                </p>
              ))}
              {searchEvidence?.privacy?.encryptedTranscriptExcluded && (
                <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  Transcript is encrypted, so plaintext evidence is
                  intentionally hidden.
                </p>
              )}
            </div>
          )}

          {searchEvidence?.evidenceUrl && (
            <a
              href={searchEvidence.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Open matching meeting context ↗
            </a>
          )}

          {evidence.length === 0 && semanticSimilarity?.matched && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This result was returned by semantic retrieval; no safe
              exact-match evidence was available to display.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ExplanationPanel;
