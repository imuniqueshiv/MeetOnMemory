import React, { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { tagApi } from "../../services";

/**
 * TagInput - Allows users to add/remove customizable tags on a meeting.
 * Supports free-form tag entry with autocomplete suggestions from the organization's tag library.
 *
 * @param {string[]} tags - Current tags on the meeting
 * @param {function} onTagsChange - Callback fired with the new tags array when tags are added/removed
 * @param {boolean} readOnly - If true, disables editing (for viewer/guest roles)
 */
const TagInput = ({ tags = [], onTagsChange, readOnly = false }) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setIsAdding(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch autocomplete suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.trim().length < 1) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await tagApi.autocomplete(inputValue.trim());
        const data = res.data?.data || res.data?.tags || [];
        // Filter out tags already applied
        const filtered = data.filter(
          (s) => !tags.includes(typeof s === "string" ? s : s.name),
        );
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } catch {
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 250);
    return () => clearTimeout(debounce);
  }, [inputValue, tags]);

  const addTag = (tagName) => {
    const trimmed = tagName.trim().toLowerCase();
    if (!trimmed || tags.includes(trimmed)) return;
    onTagsChange([...tags, trimmed]);
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove) => {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setShowSuggestions(false);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  // Tag color palette for visual variety
  const tagColors = [
    "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  ];

  const getTagColor = (tag) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return tagColors[Math.abs(hash) % tagColors.length];
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700" ref={containerRef}>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 font-semibold">
        Tags
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-all ${getTagColor(tag)}`}
          >
            #{tag}
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}

        {!readOnly && !isAdding && (
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-all cursor-pointer"
          >
            <Plus size={12} />
            Add Tag
          </button>
        )}

        {!readOnly && isAdding && (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a tag..."
              className="w-32 px-3 py-1 text-xs rounded-full border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                {suggestions.map((s) => {
                  const name = typeof s === "string" ? s : s.name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => addTag(name)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      #{name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagInput;
