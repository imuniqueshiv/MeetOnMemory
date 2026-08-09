import React, { useState, useEffect } from "react";
import { detectTerms, getCachedDetection } from "../../services/glossaryApi";

const GlossaryHighlighter = ({ text }) => {
  // Check cache synchronously for initial state to prevent flicker
  const cached = getCachedDetection(text);

  const [matches, setMatches] = useState(cached || []);
  const [loading, setLoading] = useState(!cached && !!text);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!text) {
        setLoading(false);
        return;
      }

      // If we already have it from cache on mount, skip fetching
      if (getCachedDetection(text)) {
        setMatches(getCachedDetection(text));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const detected = await detectTerms(text);
        setMatches(detected || []);
      } catch (error) {
        console.error("Error detecting glossary terms:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [text]);

  if (!text) return null;
  if (loading) return <span>{text}</span>;
  if (matches.length === 0) return <span>{text}</span>;

  // Build the highlighted text
  const parts = [];
  let currentIndex = 0;

  matches.forEach((match, index) => {
    // Avoid overlapping matches
    if (match.startIndex < currentIndex) return;

    // Add text before the match
    if (match.startIndex > currentIndex) {
      parts.push(text.substring(currentIndex, match.startIndex));
    }

    // Add the highlighted match
    parts.push(
      <span
        key={`match-${index}`}
        className="relative group cursor-pointer text-indigo-600 font-medium decoration-dashed decoration-indigo-300 underline underline-offset-4"
      >
        {text.substring(match.startIndex, match.endIndex)}

        {/* Tooltip */}
        <div className="absolute z-50 left-0 bottom-full mb-2 hidden w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-lg group-hover:block">
          <div className="text-sm font-semibold text-gray-900 mb-1">
            {match.matchedText}
            {match.category && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                {match.category}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600">{match.definition}</div>
        </div>
      </span>,
    );

    currentIndex = match.endIndex;
  });

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return <span>{parts}</span>;
};

export default GlossaryHighlighter;
