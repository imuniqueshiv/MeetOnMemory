import React from "react";
import { Search } from "lucide-react";

const PolicyFilters = ({
  query,
  setQuery,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Search policies, keywords, authors…"
          aria-label="Search policies"
        />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500 shrink-0">Sort by</span>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          aria-label="Sort field"
        >
          <option value="updatedAt">Last updated</option>
          <option value="createdAt">Created</option>
          <option value="name">Name</option>
        </select>
        <select
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          aria-label="Sort direction"
        >
          <option value="desc">Newest</option>
          <option value="asc">Oldest</option>
        </select>
      </div>
    </div>
  );
};

export default PolicyFilters;
