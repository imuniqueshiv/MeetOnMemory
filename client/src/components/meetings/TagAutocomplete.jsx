import React, { useState, useEffect, useRef } from "react";
import { Tag, X, Plus } from "lucide-react";
import { tagApi } from "../../services";

const TagAutocomplete = ({ selectedTags, setSelectedTags }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  // Debounced search
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await tagApi.autocomplete(query);
        if (res.data?.success) {
          // Filter out already selected tags
          const filtered = res.data.data.filter(
            (tag) => !selectedTags.includes(tag.name),
          );
          setSuggestions(filtered);
        }
      } catch (error) {
        console.error("Failed to fetch tags", error);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, selectedTags]);

  const handleAddTag = (tagName) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags([...selectedTags, tagName]);
    }
    setQuery("");
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleRemoveTag = (tagName) => {
    setSelectedTags(selectedTags.filter((t) => t !== tagName));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      // If there's an exact match in suggestions, add it. Otherwise, create it (as a string tag in the array).
      // The backend will handle tag creation if it doesn't exist yet, or we can just pass the string.
      const exactMatch = suggestions.find(
        (s) => s.name.toLowerCase() === query.trim().toLowerCase(),
      );
      handleAddTag(exactMatch ? exactMatch.name : query.trim());
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
        <Tag className="w-4 h-4 text-blue-500 dark:text-blue-400" />
        Tags
      </label>

      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg text-sm border border-blue-200 dark:border-blue-800"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Type a tag and press Enter"
          className="block w-full text-sm text-gray-700 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
        />

        {isOpen && query.trim() && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((tag) => (
              <button
                key={tag._id}
                type="button"
                onClick={() => handleAddTag(tag.name)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: tag.color || "#3B82F6" }}
                >
                  #
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {tag.name}
                  </div>
                  {tag.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {tag.description}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {/* Option to add new tag if no exact match */}
            {!suggestions.some(
              (s) => s.name.toLowerCase() === query.trim().toLowerCase(),
            ) && (
              <button
                type="button"
                onClick={() => handleAddTag(query.trim())}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Create "{query.trim()}"
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagAutocomplete;
