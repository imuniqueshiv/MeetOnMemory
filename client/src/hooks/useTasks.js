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

  // UI state
  const [showFilters, setShowFilters] = useState(false);

  // Fetch action items
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await knowledgeApi.getActionItems("all");

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
          }));
          setTasks(items);
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
  }, []);

  // Get unique values for filters
  const organizations = useMemo(
    () => [...new Set(tasks.map((t) => t.organization))],
    [tasks],
  );
  const assignedUsers = useMemo(
    () => [...new Set(tasks.map((t) => t.owner))],
    [tasks],
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        task.title?.toLowerCase().includes(searchLower) ||
        task.meetingTitle?.toLowerCase().includes(searchLower) ||
        task.owner?.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      // Priority filter
      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;

      // Organization filter
      const matchesOrganization =
        organizationFilter === "all" ||
        task.organization === organizationFilter;

      // Assigned user filter
      const matchesAssigned =
        assignedFilter === "all" || task.owner === assignedFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesOrganization &&
        matchesAssigned
      );
    });
  }, [
    tasks,
    searchQuery,
    statusFilter,
    priorityFilter,
    organizationFilter,
    assignedFilter,
  ]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "dueDate": {
          if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else comparison = new Date(a.dueDate) - new Date(b.dueDate);
          break;
        }
        case "createdDate": {
          comparison = new Date(a.meetingDate) - new Date(b.meetingDate);
          break;
        }
        case "priority": {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        }
        case "status": {
          const statusOrder = {
            open: 0,
            "in-progress": 1,
            resolved: 2,
            superseded: 3,
          };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        }
        case "alphabetical": {
          comparison = a.title.localeCompare(b.title);
          break;
        }
        case "importance": {
          comparison = (b.importanceScore ?? 0) - (a.importanceScore ?? 0);
          break;
        }
        default: {
          comparison = 0;
        }
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredTasks, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
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
    clearFilters,
    hasActiveFilters,
  };
}
