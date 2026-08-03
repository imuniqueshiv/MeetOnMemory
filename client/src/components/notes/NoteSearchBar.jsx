import React from "react";
import { Search, X, Filter } from "lucide-react";

/**
 * Reusable NoteSearchBar component supporting real-time text input,
 * field filter selection (title vs content vs tags vs all), and clear action.
 */
const NoteSearchBar = ({
  searchQuery,
  onSearchChange,
  filterType = "all",
  onFilterTypeChange,
  onClear,
}) => {
  return (
    <div className="w-full flex flex-col sm:flex-row gap-3 items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Search Input Container */}
      <div className="relative flex-1 w-full">
        <Search
          className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
          size={18}
          aria-hidden="true"
        />
        <input
          type="text"
          id="homepage-note-search"
          role="searchbox"
          aria-label="Search notes"
          placeholder="Search notes by title, content, or tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter Category Select */}
      {onFilterTypeChange && (
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Filter size={16} className="text-gray-400 dark:text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value)}
            aria-label="Filter by field"
            className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Fields</option>
            <option value="title">Title Only</option>
            <option value="content">Content Only</option>
            <option value="tags">Tags Only</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default NoteSearchBar;
