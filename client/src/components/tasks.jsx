import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import AppContent from "../context/AppContent";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  X,
  Calendar,
  User,
  Building2,
  FileText,
  Loader2,
  ChevronDown,
  ExternalLink,
  GitMerge,
  ShieldAlert,
} from "lucide-react";

/**
 * Tasks.jsx
 * Displays and manages action items extracted from meeting summaries
 */

const STATUS_STYLES = {
  open: {
    label: "Open",
    bgColor: "bg-slate-100 dark:bg-slate-800",
    textColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-200 dark:border-slate-700",
    icon: Clock,
  },

  "in-progress": {
    label: "In Progress",
    bgColor: "bg-blue-50 dark:bg-blue-900/30",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: Loader2,
  },

  resolved: {
    label: "Resolved",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
    textColor: "text-emerald-700 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },

  superseded: {
    label: "Superseded",
    bgColor: "bg-red-50 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
    icon: AlertCircle,
  },
};

const PRIORITY_STYLES = {
  high: {
    label: "High",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
  },
  medium: {
    label: "Medium",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    textColor: "text-amber-700 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  low: {
    label: "Low",
    bgColor: "bg-slate-100 dark:bg-slate-800",
    textColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-200 dark:border-slate-700",
  },
};

const Tasks = () => {
  const navigate = useNavigate();

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

  // Extract tasks from meetings
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
  const organizations = [...new Set(tasks.map((t) => t.organization))];
  const assignedUsers = [...new Set(tasks.map((t) => t.owner))];

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
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
      organizationFilter === "all" || task.organization === organizationFilter;

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

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "dueDate": {
        if (!a.dueDate) comparison = 1;
        else if (!b.dueDate) comparison = -1;
        else comparison = new Date(a.dueDate) - new Date(b.dueDate);
        break;
      }
      case "createdDate": {
        const aTime = a.meetingDate ? new Date(a.meetingDate).getTime() : null;
        const bTime = b.meetingDate ? new Date(b.meetingDate).getTime() : null;

        if (aTime === null && bTime === null) {
          comparison = 0;
        } else if (aTime === null) {
          comparison = 1; // a goes to the end
        } else if (bTime === null) {
          comparison = -1; // b goes to the end
        } else {
          comparison = aTime - bTime;
        }
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

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8 fade-in-up flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Tasks & Action Items
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Track and manage action items from your meeting summaries
            </p>
          </div>
          <button
            onClick={() => navigate("/knowledge/consolidate")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <GitMerge className="w-4 h-4" />
            Consolidate memories
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 fade-in-up stagger-1">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks, meetings, or assignees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl font-medium transition-all ${
                showFilters || hasActiveFilters
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-blue-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl fade-in-up">
              <div className="flex flex-wrap gap-4">
                {/* Status Filter */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="superseded">Superseded</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                {/* Organization Filter */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Organization
                  </label>
                  <select
                    value={organizationFilter}
                    onChange={(e) => setOrganizationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Organizations</option>
                    {organizations.map((org) => (
                      <option key={org} value={org}>
                        {org}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assigned Filter */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Assigned To
                  </label>
                  <select
                    value={assignedFilter}
                    onChange={(e) => setAssignedFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Assignees</option>
                    {assignedUsers.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sorting */}
        <div className="mb-6 flex items-center gap-4 text-sm fade-in-up stagger-2">
          <span className="text-slate-500 dark:text-slate-400">Sort by:</span>
          <div className="flex flex-wrap gap-2">
            {[
              { field: "dueDate", label: "Due Date" },
              { field: "createdDate", label: "Recently Created" },
              { field: "priority", label: "Priority" },
              { field: "importance", label: "Importance" },
              { field: "status", label: "Status" },
              { field: "alphabetical", label: "A-Z" },
            ].map((sort) => (
              <button
                key={sort.field}
                onClick={() => handleSort(sort.field)}
                className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  sortBy === sort.field
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {sort.label}
                {sortBy === sort.field &&
                  (sortOrder === "asc" ? (
                    <ArrowUp className="w-4 h-4" />
                  ) : (
                    <ArrowDown className="w-4 h-4" />
                  ))}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 fade-in-up">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              Loading tasks...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center fade-in-up">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Error Loading Tasks
            </h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center fade-in-up">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {hasActiveFilters
                ? "No tasks match your filters"
                : "No action items yet"}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {hasActiveFilters
                ? "Try adjusting your filters or search terms"
                : "Upload and transcribe meetings to generate action items"}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => navigate("/upload-meeting")}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Upload Meeting
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 fade-in-up stagger-3">
            {sortedTasks.map((task) => {
              const statusStyle = STATUS_STYLES[task.status] || {};
              const priorityStyle = PRIORITY_STYLES[task.priority] || {};
              const StatusIcon = statusStyle.icon || Clock;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-2">
                          {task.title}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priorityStyle.bgColor} ${priorityStyle.textColor} ${priorityStyle.borderColor} shrink-0`}
                        >
                          {priorityStyle.label || task.priority}
                        </span>
                        {typeof task.importanceScore === "number" && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 shrink-0"
                            title="Memory importance score"
                          >
                            {task.importanceScore}/100
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                        {/* Status */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${statusStyle.bgColor} ${statusStyle.textColor} ${statusStyle.borderColor}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusStyle.label || task.status}
                        </span>

                        {/* Due Date */}
                        {task.dueDate && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}

                        {/* Assigned To */}
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {task.owner}
                        </span>

                        {/* Organization */}
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {task.organization}
                        </span>
                      </div>
                    </div>

                    {/* Meeting Link */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/meeting/${task.meetingId}`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors shrink-0"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">View Meeting</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Task Details Modal */}
        {selectedTask && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedTask(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Task Details
                </h2>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="space-y-6">
                  {/* Task Title */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {selectedTask.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      {selectedTask.description}
                    </p>
                  </div>

                  {/* Status and Priority */}
                  <div className="flex flex-wrap gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                        STATUS_STYLES[selectedTask.status]?.bgColor || ""
                      } ${STATUS_STYLES[selectedTask.status]?.textColor || ""} ${
                        STATUS_STYLES[selectedTask.status]?.borderColor || ""
                      }`}
                    >
                      {React.createElement(
                        STATUS_STYLES[selectedTask.status]?.icon || Clock,
                        {
                          className: "w-4 h-4",
                        },
                      )}
                      {STATUS_STYLES[selectedTask.status]?.label ||
                        selectedTask.status}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                        PRIORITY_STYLES[selectedTask.priority]?.bgColor || ""
                      } ${PRIORITY_STYLES[selectedTask.priority]?.textColor || ""} ${
                        PRIORITY_STYLES[selectedTask.priority]?.borderColor ||
                        ""
                      }`}
                    >
                      {PRIORITY_STYLES[selectedTask.priority]?.label ||
                        selectedTask.priority}{" "}
                      Priority
                    </span>
                  </div>

                  {/* Details */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                        <User className="w-4 h-4" />
                        Assigned To
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {selectedTask.owner}
                      </p>
                    </div>

                    {selectedTask.dueDate && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                          <Calendar className="w-4 h-4" />
                          Due Date
                        </div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {new Date(selectedTask.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                        <Building2 className="w-4 h-4" />
                        Organization
                      </div>
                      {selectedTask.meetingDate && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                            <Calendar className="w-4 h-4" />
                            Meeting Date
                          </div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {new Date(
                              selectedTask.meetingDate,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                        <FileText className="w-4 h-4" />
                        Meeting Date
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {new Date(
                          selectedTask.meetingDate,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Related Meeting */}
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
                          <FileText className="w-4 h-4" />
                          Related Meeting
                        </div>
                        <p className="font-medium text-slate-900">
                          {selectedTask.meetingTitle}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTask(null);
                          navigate(`/meeting/${selectedTask.meetingId}`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        View Meeting
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Tasks;
