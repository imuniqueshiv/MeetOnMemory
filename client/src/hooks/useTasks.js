import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { knowledgeApi } from "../services";

export default function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");

  // Sorting
  const [sortBy, setSortBy] = useState("dueDate");
  const [sortOrder, setSortOrder] = useState("asc");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // UI state
  const [showFilters, setShowFilters] = useState(false);

  // Reset page to 1 when filters or sorting change
  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    statusFilter,
    priorityFilter,
    organizationFilter,
    assignedFilter,
    sortBy,
    sortOrder,
  ]);

  // Fetch action items
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);

        const options = {
          search: searchQuery || undefined,
          owner: assignedFilter !== "all" ? assignedFilter : undefined,
          priority: priorityFilter !== "all" ? priorityFilter : undefined,
          organization: organizationFilter !== "all" ? organizationFilter : undefined,
          page,
          limit,
          sortOrder,
        };
        const res = await knowledgeApi.getActionItems(statusFilter, sortBy, options);

        if (res.data?.success) {
          const items = res.data.actionItems.map((item) => ({
            id: item._id,
            title: item.text,
            owner: item.owner || "Unassigned",
            dueDate: item.dueDate,
            status: item.status || "open",

            meetingId: item.sourceMeetingId?._id,
            meetingTitle: item.sourceMeetingId?.title,
            meetingDate: item.sourceMeetingId?.date,

            priority: item.priority || "medium",
            organization:
              item.sourceMeetingId?.organization?.name || "Personal",
            description: item.description || item.text,
            importanceScore: item.importanceScore ?? null,
            remindersEnabled: item.remindersEnabled !== false,
            reminderSent: item.reminderSent || {
              upcoming: false,
              overdue: false,
            },
          }));
          setTasks(items);
          setTotalPages(res.data.pagination?.totalPages || 1);
          setTotal(res.data.pagination?.total || 0);
        } else {
          setError(res.data?.message || "Failed to load tasks");
          toast.error(res.data?.message || "Failed to load tasks");
        }
      } catch (err) {
        console.error("Error fetching tasks:", err);
        setError("Unable to fetch tasks");
        toast.error("Unable to fetch tasks");
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [
    page,
    limit,
    statusFilter,
    priorityFilter,
    organizationFilter,
    assignedFilter,
    sortBy,
    sortOrder,
    searchQuery,
  ]);

  // Get unique values for filters
  const organizations = useMemo(
    () => [...new Set(tasks.map((t) => t.organization))],
    [tasks],
  );
  const assignedUsers = useMemo(
    () => [...new Set(tasks.map((t) => t.owner))],
    [tasks],
  );

  // Removed client-side filtering and sorting for Issue #903
  const sortedTasks = tasks;

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
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
    setStatusFilter("all");
    setPriorityFilter("all");
    setOrganizationFilter("all");
    setAssignedFilter("all");
  };

  const hasActiveFilters =
    searchQuery ||
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
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    organizationFilter,
    setOrganizationFilter,
    assignedFilter,
    setAssignedFilter,
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
    setPage,
    limit,
    setLimit,
    totalPages,
    total,
  };
}
