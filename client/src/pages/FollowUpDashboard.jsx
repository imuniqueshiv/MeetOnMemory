import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Calendar,
  Filter,
  RefreshCw,
  ChevronRight,
  Bell,
  Target,
  Award,
} from "lucide-react";
import { toast } from "react-toastify";

const FollowUpDashboard = () => {
  const navigate = useNavigate();
  const { backendUrl } = useContext(AppContent);

  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(
        `${backendUrl}/api/followup/tasks?${params}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }

      const data = await response.json();
      setTasks(data.tasks);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, page, statusFilter]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/followup/analytics`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchTasks();
    fetchAnalytics();
  }, [fetchTasks, fetchAnalytics]);

  const updateTaskStatus = async (taskId, status) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/followup/tasks/${taskId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      toast.success("Task status updated");
      fetchTasks();
      fetchAnalytics();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update task status");
    }
  };

  const acknowledgeTask = async (taskId) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/followup/tasks/${taskId}/acknowledge`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to acknowledge task");
      }

      toast.success("Task acknowledged");
      fetchTasks();
    } catch (error) {
      console.error("Error acknowledging task:", error);
      toast.error("Failed to acknowledge task");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      "in-progress":
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      completed:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      cancelled:
        "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    };
    return colors[status] || colors.pending;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
      medium:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    };
    return colors[priority] || colors.medium;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntilDeadline = (deadline) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  // Prepare chart data
  const statusChartData = analytics
    ? [
        {
          name: "Pending",
          value: analytics.summary.pendingTasks,
          color: "#f59e0b",
        },
        {
          name: "In Progress",
          value: analytics.summary.inProgressTasks,
          color: "#3b82f6",
        },
        {
          name: "Completed",
          value: analytics.summary.completedTasks,
          color: "#10b981",
        },
        {
          name: "Overdue",
          value: analytics.summary.overdueTasks,
          color: "#ef4444",
        },
      ]
    : [];

  const trendChartData = analytics?.trends || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <div className="pt-20 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Follow-Up Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Track action items, monitor deadlines, and manage follow-ups
          </p>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              icon={Target}
              label="Completion Rate"
              value={`${analytics.summary.completionRate.toFixed(1)}%`}
              subtitle={`${analytics.summary.completedTasks} of ${analytics.summary.totalTasks}`}
              color="green"
            />
            <MetricCard
              icon={Clock}
              label="Avg Completion Time"
              value={`${analytics.summary.avgTimeToCompletion.toFixed(1)}d`}
              subtitle="Days to complete"
              color="blue"
            />
            <MetricCard
              icon={AlertCircle}
              label="Overdue Tasks"
              value={analytics.summary.overdueTasks}
              subtitle={`${analytics.summary.overdueRate.toFixed(1)}% overdue rate`}
              color="red"
            />
            <MetricCard
              icon={Award}
              label="On-Time Rate"
              value={`${analytics.summary.onTimeRate.toFixed(1)}%`}
              subtitle="Completed before deadline"
              color="purple"
            />
          </div>
        )}

        {/* Charts */}
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Status Distribution */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                Task Status Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Trends Over Time */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                Weekly Trends
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="#3b82f6"
                    name="Created"
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#10b981"
                    name="Completed"
                  />
                  <Line
                    type="monotone"
                    dataKey="overdue"
                    stroke="#ef4444"
                    name="Overdue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Action Items
            </h2>
            <button
              onClick={() => {
                fetchTasks();
                fetchAnalytics();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            {["all", "pending", "in-progress", "completed", "overdue"].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === status
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {status === "all"
                    ? "All"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ),
            )}
          </div>

          {/* Task List */}
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                Loading tasks...
              </p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                {statusFilter === "all"
                  ? "No action items found"
                  : `No ${statusFilter} tasks`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const daysUntil = getDaysUntilDeadline(task.deadline);
                const isOverdue = daysUntil < 0;

                return (
                  <div
                    key={task._id}
                    className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/followup/tasks/${task._id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                              task.status,
                            )}`}
                          >
                            {task.status}
                          </span>
                          {task.metadata?.priority && (
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                                task.metadata.priority,
                              )}`}
                            >
                              {task.metadata.priority}
                            </span>
                          )}
                          {!task.acknowledged && task.status === "pending" && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                              New
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                          {task.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          From: {task.meeting?.title || "Meeting"}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(task.deadline)}</span>
                        </div>
                        {isOverdue && (
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <AlertCircle className="w-4 h-4" />
                            <span>{Math.abs(daysUntil)} days overdue</span>
                          </div>
                        )}
                        {!isOverdue && daysUntil <= 7 && (
                          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                            <Clock className="w-4 h-4" />
                            <span>
                              {daysUntil === 0
                                ? "Due today"
                                : `${daysUntil} days left`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!task.acknowledged && task.status === "pending" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              acknowledgeTask(task._id);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                          >
                            Acknowledge
                          </button>
                        )}
                        {task.status === "pending" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task._id, "in-progress");
                            }}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                          >
                            Start
                          </button>
                        )}
                        {task.status === "in-progress" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task._id, "completed");
                            }}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Showing {(page - 1) * 20 + 1} to{" "}
                {Math.min(page * 20, pagination.total)} of {pagination.total}{" "}
                tasks
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, label, value, subtitle, color }) => {
  // Assign to capitalized local variable to satisfy JSX component naming
  // and avoid ESLint no-unused-vars false positives on destructuring renames
  const Icon = icon;

  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green:
      "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    purple:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between mb-2">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      )}
    </div>
  );
};

export default FollowUpDashboard;
