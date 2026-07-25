import React, { useState, useEffect, useCallback, useRef } from "react";
import { organizationApi } from "../../services";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar.jsx";
import {
  Search,
  Filter,
  Users,
  Clock,
  Globe,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";

const BrowseOrganizations = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [filter, setFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const observerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch organizations
  const fetchOrganizations = async (
    page = 1,
    search = searchQuery,
    sort = sortBy,
    filt = filter,
    append = false,
  ) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const params = {
        page,
        limit: pagination.limit,
        search: search.trim(),
        sortBy: sort,
        filter: filt,
      };

      const { data } = await organizationApi.browsePublicOrganizations(params);

      if (data.success) {
        if (append) {
          setOrganizations((prev) => [...prev, ...data.organizations]);
        } else {
          setOrganizations(data.organizations);
        }
        setPagination(data.pagination);
      } else {
        setError(data.message || "Failed to fetch organizations");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch organizations");
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Debounced search
  const debouncedSearch = useCallback(
    (query) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        fetchOrganizations(1, query, sortBy, filter);
      }, 300);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, filter],
  );

  // Initial load
  useEffect(() => {
    fetchOrganizations(1, searchQuery, sortBy, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle search input
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  // Handle sort change
  const handleSortChange = (value) => {
    setSortBy(value);
    fetchOrganizations(1, searchQuery, value, filter);
  };

  // Handle filter change
  const handleFilterChange = (value) => {
    setFilter(value);
    fetchOrganizations(1, searchQuery, sortBy, value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    fetchOrganizations(1, "", sortBy, filter);
  };

  // Infinite scroll observer
  const lastElementRef = useCallback(
    (node) => {
      if (loadingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && pagination.hasNextPage) {
          fetchOrganizations(
            pagination.page + 1,
            searchQuery,
            sortBy,
            filter,
            true,
          );
        }
      });

      if (node) observerRef.current.observe(node);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadingMore, pagination.hasNextPage, searchQuery, sortBy, filter],
  );

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Handle view profile
  const handleViewProfile = (slug) => {
    navigate(`/organizations/${slug}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Discover Organizations
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Browse and search public organizations to find your community
            </p>
          </div>

          {/* Search and Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-8 shadow-sm">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search organizations by name, slug, or description..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Sort by:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="createdAt">Recently Created</option>
                  <option value="name">Alphabetical</option>
                  <option value="members">Member Count</option>
                </select>
              </div>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleFilterChange("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => handleFilterChange("recent")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === "recent"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    Recently Created (30 days)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/4" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <X className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Error Loading Organizations
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
              <button
                onClick={() =>
                  fetchOrganizations(1, searchQuery, sortBy, filter)
                }
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && organizations.length === 0 && (
            <div className="text-center py-16">
              <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Organizations Found
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchQuery
                  ? "No organizations match your search. Try a different query."
                  : "There are no public organizations available at the moment."}
              </p>
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold transition-all"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}

          {/* Organizations Grid */}
          {!loading && !error && organizations.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organizations.map((org, index) => {
                  const isLast = index === organizations.length - 1;
                  return (
                    <div
                      key={org._id}
                      ref={isLast ? lastElementRef : null}
                      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300"
                    >
                      {/* Organization Header */}
                      <div className="flex items-start gap-4 mb-4">
                        {/* Logo */}
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0">
                          {org.logo ? (
                            <img
                              src={org.logo}
                              alt={org.name}
                              className="w-full h-full rounded-xl object-cover"
                            />
                          ) : (
                            org.name?.charAt(0)?.toUpperCase() || "O"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                            {org.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                            @{org.slug}
                          </p>
                          {/* Visibility Badge */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            <Globe className="w-3 h-3" />
                            Public
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {org.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                          {org.description}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          <span>{org.memberCount || 0} members</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>Created {formatDate(org.createdAt)}</span>
                        </div>
                      </div>

                      {/* View Profile Button */}
                      <button
                        onClick={() => handleViewProfile(org.slug)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg"
                      >
                        View Profile
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Load More Indicator */}
              {loadingMore && (
                <div className="flex justify-center mt-8">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading more organizations...</span>
                  </div>
                </div>
              )}

              {/* Pagination Info */}
              {!loadingMore && pagination.totalPages > 1 && (
                <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
                  Showing {organizations.length} of {pagination.total}{" "}
                  organizations
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowseOrganizations;
