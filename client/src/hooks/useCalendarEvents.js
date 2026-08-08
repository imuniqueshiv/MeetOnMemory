import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../services";
import apiClient from "../services/apiClient.js";

/**
 * Custom hook for managing calendar events with server-side pagination
 *
 * Features:
 * - Fetches only meetings within the visible date range
 * - Supports pagination for large result sets
 * - Caches recently viewed date ranges
 * - Handles external calendar events
 * - Client-side filtering for status, type, and organization
 *
 * Issue #1234: Replaced full meeting download with date-range filtered requests
 */
export const useCalendarEvents = () => {
  // Core state
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // 'month' | 'week' | 'day'
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [showExternalEvents, setShowExternalEvents] = useState(true);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Cache for date range queries (prevents redundant API calls)
  const [dateRangeCache, setDateRangeCache] = useState(new Map());

  /**
   * Calculate date range based on current view and date
   * Returns start and end dates for the visible calendar range
   */
  const getDateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === "month") {
      // Month view: show entire month (including overflow days)
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay()); // Start from Sunday
      end.setMonth(end.getMonth() + 1);
      end.setDate(0); // Last day of month
      end.setDate(end.getDate() + (6 - end.getDay())); // End on Saturday
    } else if (view === "week") {
      // Week view: show 7 days
      start.setDate(start.getDate() - start.getDay());
      end.setDate(start.getDate() + 6);
    } else {
      // Day view: show single day
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    // Add buffer days for better UX (show some context)
    const bufferDays = view === "day" ? 7 : 14;
    start.setDate(start.getDate() - bufferDays);
    end.setDate(end.getDate() + bufferDays);

    return { start, end };
  }, [currentDate, view]);

  /**
   * Generate cache key for date range
   */
  const getCacheKey = useCallback(() => {
    const { start, end } = getDateRange;
    return `${start.toISOString()}_${end.toISOString()}_${view}`;
  }, [getDateRange, view]);

  /**
   * Fetch meetings for the current date range with pagination
   * Only requests meetings within the visible calendar range
   */
  const fetchMeetings = useCallback(async () => {
    setLoading(true);

    try {
      const cacheKey = getCacheKey();
      const { start, end } = getDateRange;

      // Check cache first (5-minute TTL)
      const cached = dateRangeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setMeetings(cached.meetings);
        setTotalPages(cached.totalPages);
        setHasMore(cached.hasMore);
        setLoading(false);
        return;
      }

      // Fetch meetings from API with date range filter
      const { data } = await meetingApi.getAllMeetings({
        page: 1,
        limit: 100, // Reasonable limit for calendar view
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      let allMeetings = [];
      if (data.success) {
        allMeetings = data.meetings || [];
        setTotalPages(data.pagination?.totalPages || 1);
        setHasMore(data.pagination?.page < data.pagination?.totalPages);
      } else {
        toast.error(data.message || "Failed to fetch meetings.");
      }

      // Fetch external calendar events (Google/Outlook)
      try {
        const { data: extData } = await apiClient.get("/api/calendar/events", {
          params: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        });

        if (extData.success && extData.events) {
          const externalEvents = extData.events.map((e) => ({
            _id: e.id,
            title: e.title,
            date: new Date(e.start),
            time: new Date(e.start).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            duration: (new Date(e.end) - new Date(e.start)) / 60000,
            venue: e.location,
            meetingType: "external",
            status: "upcoming",
            provider: e.provider,
            isExternal: true,
          }));
          allMeetings = [...allMeetings, ...externalEvents];
        }
      } catch (extErr) {
        console.error("External events fetch error:", extErr);
      }

      // Update cache
      const newCache = new Map(dateRangeCache);
      newCache.set(cacheKey, {
        meetings: allMeetings,
        totalPages: data.pagination?.totalPages || 1,
        hasMore: data.pagination?.page < data.pagination?.totalPages,
        timestamp: Date.now(),
      });
      setDateRangeCache(newCache);

      setMeetings(allMeetings);
    } catch (err) {
      console.error("Fetch meetings error:", err);
      toast.error("Error loading calendar data.");
    } finally {
      setLoading(false);
    }
  }, [getCacheKey, getDateRange, dateRangeCache]);

  // Fetch meetings when date range or view changes
  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  /**
   * Load more meetings (pagination)
   */
  const loadMoreMeetings = useCallback(async () => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const { start, end } = getDateRange;
      const nextPage = page + 1;

      const { data } = await meetingApi.getAllMeetings({
        page: nextPage,
        limit: 100,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      if (data.success && data.meetings) {
        setMeetings((prev) => [...prev, ...data.meetings]);
        setPage(nextPage);
        setHasMore(nextPage < data.pagination?.totalPages);
      }
    } catch (err) {
      console.error("Error loading more meetings:", err);
      toast.error("Failed to load more meetings");
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, page, getDateRange]);

  /**
   * Clear cache and refetch (useful after creating/updating meetings)
   */
  const invalidateCache = useCallback(() => {
    setDateRangeCache(new Map());
    fetchMeetings();
  }, [fetchMeetings]);

  // Client-side filtering (status, type, organization)
  const filteredMeetings = meetings.filter((meeting) => {
    // Filter external events
    if (meeting.isExternal && !showExternalEvents) {
      return false;
    }

    // Status filter
    const matchesStatus =
      statusFilter === "all" || meeting.status === statusFilter;

    // Type filter
    const matchesType =
      typeFilter === "all" || meeting.meetingType === typeFilter;

    // Organization filter
    let matchesOrg = true;
    if (orgFilter !== "all" && !meeting.isExternal) {
      if (orgFilter === "personal") {
        matchesOrg = !meeting.organization;
      } else {
        matchesOrg =
          meeting.organization === orgFilter ||
          (meeting.organization?._id &&
            meeting.organization._id === orgFilter) ||
          (meeting.organization?.name &&
            meeting.organization.name === orgFilter);
      }
    }

    return matchesStatus && matchesType && matchesOrg;
  });

  // Extract unique organizations for filter dropdown
  const uniqueOrgs = Array.from(
    new Set(
      meetings
        .filter((m) => !m.isExternal)
        .map((m) => m.organization?.name || m.organization)
        .filter(Boolean),
    ),
  );

  return {
    meetings: filteredMeetings,
    allMeetings: meetings,
    loading,
    currentDate,
    setCurrentDate,
    view,
    setView,
    selectedMeeting,
    setSelectedMeeting,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    orgFilter,
    setOrgFilter,
    showExternalEvents,
    setShowExternalEvents,
    filteredMeetings,
    uniqueOrgs,
    hasMore,
    loadMoreMeetings,
    invalidateCache,
    pagination: {
      page,
      totalPages,
      hasMore,
    },
  };
};
