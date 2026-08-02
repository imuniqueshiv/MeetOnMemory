import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../../services";
import { Trash2, Download, Edit2, Eye, Search, Filter } from "lucide-react";
import AppContent from "../../context/AppContent";
import MeetingCard from "./MeetingCard.jsx";
import MeetingSearch from "./MeetingSearch.jsx";
import MeetingFilters from "./MeetingFilters.jsx";
import Pagination from "./Pagination.jsx";
import EmptyState from "./EmptyState.jsx";
import { useNavigate } from "react-router-dom";

const MeetingRepository = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [filteredMeetings, setFilteredMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    meetingType: "all",
    dateRange: "all",
    sortBy: "createdAt-desc",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Fetch meetings
  const fetchMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await meetingApi.getAllMeetings();

      if (response.data?.success) {
        setMeetings(response.data.meetings || []);
      } else {
        setError("Failed to fetch meetings");
      }
    } catch (err) {
      console.error("Error fetching meetings:", err);
      setError(err.response?.data?.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...meetings];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (meeting) =>
          meeting.title?.toLowerCase().includes(query) ||
          meeting.summary?.toLowerCase().includes(query) ||
          meeting.transcript?.toLowerCase().includes(query) ||
          meeting.tags?.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    // Apply status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(
        (meeting) => meeting.status === filters.status,
      );
    }

    // Apply meeting type filter
    if (filters.meetingType !== "all") {
      filtered = filtered.filter(
        (meeting) => meeting.meetingType === filters.meetingType,
      );
    }

    // Apply date range filter
    if (filters.dateRange !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((meeting) => {
        const meetingDate = new Date(meeting.date || meeting.createdAt);

        switch (filters.dateRange) {
          case "today":
            return meetingDate >= today;
          case "week": {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return meetingDate >= weekAgo;
          }
          case "month": {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return meetingDate >= monthAgo;
          }
          case "year": {
            const yearAgo = new Date(today);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            return meetingDate >= yearAgo;
          }
          default:
            return true;
        }
      });
    }

    // Apply sorting
    const [sortBy, sortOrder] = filters.sortBy.split("-");
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "createdAt":
          comparison = new Date(a.createdAt) - new Date(b.createdAt);
          break;
        case "date":
          comparison =
            new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredMeetings(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [meetings, searchQuery, filters]);

  // Pagination logic
  const totalPages = Math.ceil(filteredMeetings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMeetings = filteredMeetings.slice(startIndex, endIndex);

  // Meeting actions
  const handleDelete = async (meetingId) => {
    if (!window.confirm("Move this meeting to the recycle bin?")) {
      return;
    }

    try {
      const response = await meetingApi.deleteMeeting(meetingId);

      if (response.data?.success) {
        toast.success("Meeting deleted successfully");
        fetchMeetings();
      } else {
        toast.error(response.data?.message || "Failed to delete meeting");
      }
    } catch (err) {
      console.error("Error deleting meeting:", err);
      toast.error(err.response?.data?.message || "Failed to delete meeting");
    }
  };

  const handleRename = async (meetingId, newTitle) => {
    try {
      const response = await meetingApi.updateMeeting(meetingId, {
        title: newTitle,
      });

      if (response.data?.success) {
        toast.success("Meeting renamed successfully");
        fetchMeetings();
      } else {
        toast.error(response.data?.message || "Failed to rename meeting");
      }
    } catch (err) {
      console.error("Error renaming meeting:", err);
      toast.error(err.response?.data?.message || "Failed to rename meeting");
    }
  };

  const handleView = (meeting) => {
    navigate(`/meeting/${meeting._id}`);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: "all",
      meetingType: "all",
      dateRange: "all",
      sortBy: "createdAt-desc",
    });
    setSearchQuery("");
  };

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.meetingType !== "all" ||
    filters.dateRange !== "all" ||
    searchQuery.trim() !== "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading meetings...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-gray-700 dark:text-gray-200 text-lg">{error}</p>
          <button
            onClick={fetchMeetings}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <MeetingSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <MeetingFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Active filters:
          </span>
          {searchQuery && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 rounded-full">
              Search: "{searchQuery}"
            </span>
          )}
          {filters.status !== "all" && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 rounded-full">
              Status: {filters.status}
            </span>
          )}
          {filters.meetingType !== "all" && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 rounded-full">
              Type: {filters.meetingType}
            </span>
          )}
          {filters.dateRange !== "all" && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 rounded-full">
              Date: {filters.dateRange}
            </span>
          )}
          <button
            onClick={handleClearFilters}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Meeting Grid */}
      {currentMeetings.length === 0 ? (
        <EmptyState
          type={
            hasActiveFilters
              ? "noResults"
              : meetings.length === 0
                ? "noMeetings"
                : "noMeetings"
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentMeetings.map((meeting) => (
              <MeetingCard
                key={meeting._id}
                meeting={meeting}
                onDelete={handleDelete}
                onRename={handleRename}
                onView={handleView}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}
    </div>
  );
};

export default MeetingRepository;
