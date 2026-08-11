import React, { useState, useEffect, useCallback, useRef } from "react";
import { organizationApi, membershipRequestApi } from "../../services";
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
  UserCheck,
  UserPlus,
  Tag,
  Sparkles,
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
  const [actionLoadingId, setActionLoadingId] = useState(null);
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
    if (!dateString) return "N/A";
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

  // Handle join or request access
  const handleJoinOrRequest = async (org) => {
    if (org.membershipStatus === "member") {
      toast.info("You are already a member of this organization");
      return;
    }
    if (org.membershipStatus === "pending") {
      toast.info(
        "A membership request is already pending for this organization",
      );
      return;
    }

    try {
      setActionLoadingId(org._id);
      if (org.joinPolicy === "open" && org.visibility === "public") {
        const { data } = await organizationApi.joinOrganization({
          organizationId: org._id,
        });
        if (data.success) {
          toast.success("Joined organization successfully!");
          setOrganizations((prev) =>
            prev.map((o) =>
              o._id === org._id
                ? {
                    ...o,
                    membershipStatus: "member",
                    memberCount: o.memberCount + 1,
                  }
                : o,
            ),
          );
        } else {
          toast.error(data.message || "Failed to join organization");
        }
      } else {
        const { data } = await membershipRequestApi.createRequest({
          organizationId: org._id,
          message: "Request to join via Browse Organizations",
        });
        if (data.success) {
          toast.success("Membership request submitted successfully!");
          setOrganizations((prev) =>
            prev.map((o) =>
              o._id === org._id ? { ...o, membershipStatus: "pending" } : o,
            ),
          );
        } else {
          toast.error(data.message || "Failed to submit membership request");
        }
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to complete operation",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex-grow container mx-auto px-4 pt-28 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Discover Organizations
            </h1>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
              Browse and search public organizations across all accounts to find
              your community and collaborate.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-8 shadow-sm">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by organization name, slug, description, or tags..."
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
            <div className="flex flex-wrap items-center justify-between gap-4">
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
                  <option value="oldest">Oldest First</option>
                  <option value="name">Alphabetical (A–Z)</option>
                  <option value="name_desc">Alphabetical (Z–A)</option>
                  <option value="members">Most Members</option>
                  <option value="recently_active">Recently Active</option>
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
                    All Public Orgs
                  </button>
                  <button
                    onClick={() => handleFilterChange("recent")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === "recent"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    Recently Created (30 Days)
                  </button>
                  <button
                    onClick={() => handleFilterChange("active")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === "active"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    Recently Active
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
                  ? "No organizations match your search. Try searching by another keyword or clearing filters."
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
                  const orgTags = org.metadata?.tags || org.tags || [];

                  return (
                    <div
                      key={org._id}
                      ref={isLast ? lastElementRef : null}
                      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 flex flex-col justify-between"
                    >
                      <div>
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
                            <div className="flex flex-wrap gap-1 items-center">
                              {/* Visibility Badge */}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                <Globe className="w-3 h-3" />
                                Public
                              </span>

                              {/* Membership Status Badge */}
                              {org.membershipStatus === "member" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  <UserCheck className="w-3 h-3" />
                                  Member
                                </span>
                              )}
                              {org.membershipStatus === "pending" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </span>
                              )}
                              {org.membershipStatus === "rejected" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  Request Rejected
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {org.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                            {org.description}
                          </p>
                        )}

                        {/* Tags */}
                        {Array.isArray(orgTags) && orgTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {orgTags.slice(0, 3).map((tagItem, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                              >
                                <Tag className="w-3 h-3" />
                                {tagItem}
                              </span>
                            ))}
                          </div>
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
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          onClick={() => handleViewProfile(org.slug)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold text-sm transition-all"
                        >
                          View Profile
                          <ArrowRight className="w-4 h-4" />
                        </button>

                        {org.membershipStatus === "member" ? (
                          <button
                            disabled
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-xl font-semibold text-sm cursor-not-allowed"
                          >
                            <UserCheck className="w-4 h-4" />
                            Member
                          </button>
                        ) : org.membershipStatus === "pending" ? (
                          <button
                            disabled
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl font-semibold text-sm cursor-not-allowed"
                          >
                            <Clock className="w-4 h-4" />
                            Pending
                          </button>
                        ) : org.membershipStatus === "rejected" ? (
                          <button
                            disabled
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-red-500/10 text-red-500 rounded-xl font-semibold text-sm cursor-not-allowed"
                          >
                            Rejected
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoinOrRequest(org)}
                            disabled={actionLoadingId === org._id}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all hover:shadow-md disabled:opacity-50"
                          >
                            {actionLoadingId === org._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : org.joinPolicy === "open" ? (
                              <>
                                <UserPlus className="w-4 h-4" />
                                Join
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4" />
                                Request Join
                              </>
                            )}
                          </button>
                        )}
                      </div>
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
