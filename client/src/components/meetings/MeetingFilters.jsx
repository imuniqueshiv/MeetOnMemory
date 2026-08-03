import React from "react";
import { Filter, ChevronDown, X } from "lucide-react";

const MeetingFilters = ({ filters, onFilterChange, onClearFilters }) => {
  const [showDropdown, setShowDropdown] = React.useState(false);

  const filterOptions = [
    {
      key: "status",
      label: "Processing Status",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "completed", label: "Completed" },
        { value: "processing", label: "Processing" },
        { value: "failed", label: "Failed" },
      ],
    },
    {
      key: "meetingType",
      label: "Meeting Type",
      options: [
        { value: "all", label: "All Types" },
        { value: "conference", label: "Conference" },
        { value: "policy", label: "Policy" },
        { value: "event", label: "Event" },
        { value: "internal", label: "Internal" },
      ],
    },
    {
      key: "dateRange",
      label: "Date Range",
      options: [
        { value: "all", label: "All Time" },
        { value: "today", label: "Today" },
        { value: "week", label: "Last 7 Days" },
        { value: "month", label: "Last 30 Days" },
        { value: "year", label: "Last Year" },
      ],
    },
    {
      key: "sortBy",
      label: "Sort By",
      options: [
        { value: "createdAt-desc", label: "Newest First" },
        { value: "createdAt-asc", label: "Oldest First" },
        { value: "date-desc", label: "Meeting Date (Newest)" },
        { value: "date-asc", label: "Meeting Date (Oldest)" },
        { value: "title-asc", label: "Title (A-Z)" },
        { value: "title-desc", label: "Title (Z-A)" },
      ],
    },
  ];

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.meetingType !== "all" ||
    filters.dateRange !== "all" ||
    filters.sortBy !== "createdAt-desc";

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
          hasActiveFilters
            ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
            : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
        }`}
      >
        <Filter size={18} />
        <span className="font-medium">Filters</span>
        {hasActiveFilters && (
          <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
            {Object.values(filters).filter((v) => v !== "all").length}
          </span>
        )}
        <ChevronDown
          size={16}
          className={`transition-transform ${showDropdown ? "rotate-180" : ""}`}
        />
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50 w-80 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Filter Meetings
            </h3>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  onClearFilters();
                  setShowDropdown(false);
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <X size={14} />
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-4">
            {filterOptions.map((filter) => (
              <div key={filter.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {filter.label}
                </label>
                <select
                  value={filters[filter.key]}
                  onChange={(e) => onFilterChange(filter.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm"
                >
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowDropdown(false)}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            Apply Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default MeetingFilters;
