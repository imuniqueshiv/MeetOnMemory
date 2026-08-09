import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { knowledgeApi } from "../services";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const mapActionItem = (item) => ({
  id: item._id,
  title: item.text,
  owner: item.owner || "Unassigned",
  dueDate: item.dueDate,
  status: item.status || "open",
  meetingId: item.sourceMeetingId?._id,
  meetingTitle: item.sourceMeetingId?.title,
  meetingDate: item.sourceMeetingId?.date,
  priority: item.priority || "medium",
  organization: item.sourceMeetingId?.organization?.name || "Personal",
  description: item.description || item.text,
  importanceScore: item.importanceScore ?? null,
  remindersEnabled: item.remindersEnabled !== false,
  reminderSent: item.reminderSent || {
    upcoming: false,
    overdue: false,
  },
});

export default function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");

  const [sortBy, setSortBy] = useState("dueDate");
  const [sortOrder, setSortOrder] = useState("asc");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [ownersFacet, setOwnersFacet] = useState([]);
  const [organizationsFacet, setOrganizationsFacet] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const requestIdRef = useRef(0);

  // Debounce search → server query; reset to first page on term change
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchQuery.trim();
      setDebouncedSearch((prev) => {
        if (prev === next) return prev;
        setPage(1);
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const resetToFirstPage = useCallback((updater) => {
    return (value) => {
      setPage(1);
      updater(value);
    };
  }, []);

  const setStatusFilterAndReset = useMemo(
    () => resetToFirstPage(setStatusFilter),
    [resetToFirstPage],
  );
  const setPriorityFilterAndReset = useMemo(
    () => resetToFirstPage(setPriorityFilter),
    [resetToFirstPage],
  );
  const setOrganizationFilterAndReset = useMemo(
    () => resetToFirstPage(setOrganizationFilter),
    [resetToFirstPage],
  );
  const setAssignedFilterAndReset = useMemo(
    () => resetToFirstPage(setAssignedFilter),
    [resetToFirstPage],
  );

  const fetchTasks = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);

      const res = await knowledgeApi.getActionItems(statusFilter, sortBy, {
        search: debouncedSearch || undefined,
        owner: assignedFilter !== "all" ? assignedFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        organization:
          organizationFilter !== "all" ? organizationFilter : undefined,
        page,
        limit: PAGE_SIZE,
        sortOrder,
      });

      if (requestId !== requestIdRef.current) return;

      if (res.data?.success) {
        setTasks((res.data.actionItems || []).map(mapActionItem));
        setTotalPages(res.data.pagination?.totalPages || 0);
        setTotal(res.data.pagination?.total || 0);
        setOwnersFacet(res.data.facets?.owners || []);
        setOrganizationsFacet(res.data.facets?.organizations || []);
      } else {
        setError(res.data?.message || "Failed to load tasks");
        toast.error(res.data?.message || "Failed to load tasks");
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Error fetching tasks:", err);
      setError("Unable to fetch tasks");
      toast.error("Unable to fetch tasks");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    page,
    statusFilter,
    priorityFilter,
    organizationFilter,
    assignedFilter,
    sortBy,
    sortOrder,
    debouncedSearch,
  ]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const organizations = useMemo(() => {
    if (organizationsFacet.length > 0) return organizationsFacet;
    return [...new Set(tasks.map((t) => t.organization))];
  }, [organizationsFacet, tasks]);

  const assignedUsers = useMemo(() => {
    if (ownersFacet.length > 0) return ownersFacet;
    return [...new Set(tasks.map((t) => t.owner))];
  }, [ownersFacet, tasks]);

  // Server already filtered/sorted the current page
  const sortedTasks = tasks;

  const handleSort = (field) => {
    setPage(1);
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder(field === "importance" ? "desc" : "asc");
    }
  };

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await knowledgeApi.updateActionItemStatus(taskId, newStatus);
      if (res.data?.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
        );
        toast.success("Task status updated");
        return true;
      } else {
        toast.error(res.data?.message || "Failed to update task status");
        return false;
      }
    } catch (err) {
      console.error("Error updating task status:", err);
      toast.error(
        err.response?.data?.message || "Failed to update task status",
      );
      return false;
    }
  };

  const toggleTaskReminder = async (taskId, currentEnabled) => {
    try {
      const newEnabled = !currentEnabled;
      const res = await knowledgeApi.toggleActionItemReminder(
        taskId,
        newEnabled,
      );
      if (res.data?.success) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, remindersEnabled: newEnabled } : t,
          ),
        );
        toast.success(
          newEnabled
            ? "Reminders enabled for action item"
            : "Reminders disabled for action item",
        );
        return true;
      } else {
        toast.error(res.data?.message || "Failed to toggle reminder");
        return false;
      }
    } catch (err) {
      console.error("Error toggled action item reminder:", err);
      toast.error(err.response?.data?.message || "Failed to toggle reminder");
      return false;
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setOrganizationFilter("all");
    setAssignedFilter("all");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    organizationFilter !== "all" ||
    assignedFilter !== "all";

  return {
    tasks,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    selectedTask,
    setSelectedTask,
    statusFilter,
    setStatusFilter: setStatusFilterAndReset,
    priorityFilter,
    setPriorityFilter: setPriorityFilterAndReset,
    organizationFilter,
    setOrganizationFilter: setOrganizationFilterAndReset,
    assignedFilter,
    setAssignedFilter: setAssignedFilterAndReset,
    sortBy,
    sortOrder,
    showFilters,
    setShowFilters,
    organizations,
    assignedUsers,
    sortedTasks,
    handleSort,
    updateTaskStatus,
    toggleTaskReminder,
    clearFilters,
    hasActiveFilters,
    page,
    setPage: handlePageChange,
    totalPages,
    total,
    limit: PAGE_SIZE,
    refetch: fetchTasks,
  };
}
