import React, { useState, useEffect, useCallback, useContext } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import apiClient from "../services/apiClient.js";
import Navbar from "../components/Navbar.jsx";
import TaskDetailsModal from "../components/tasks/TaskDetailsModal.jsx";
import AppContent from "../context/AppContent";
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
  BellOff,
  ChevronUp,
} from "lucide-react";
import { toast } from "react-toastify";

const FollowUpDashboard = () => {
  const navigate = useNavigate();
  const { id: taskIdFromParams } = useParams();
  const { userData } = useContext(AppContent) || {};
  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Persist status filter in localStorage
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem("meetonmemory:followup_status_filter") || "all";
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  // Snooze and Escalate UI states
  const [snoozeTaskItem, setSnoozeTaskItem] = useState(null);
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");
  const [escalateTaskItem, setEscalateTaskItem] = useState(null);
  const [escalateReason, setEscalateReason] = useState("");

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    localStorage.setItem("meetonmemory:followup_status_filter", status);
    setPage(1);
  };

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page.toString(),
        limit: "20",
      };

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const { data } = await apiClient.get("/api/followup/tasks", { params });
      setTasks(data.tasks);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/api/followup/analytics");
      setAnalytics(data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchAnalytics();
  }, [fetchTasks, fetchAnalytics]);

  useEffect(() => {
    if (taskIdFromParams) {
      const found = tasks.find((t) => t._id === taskIdFromParams);
      if (found) {
        setSelectedTask(found);
      } else {
        (async () => {
          try {
            const { data } = await apiClient.get(
              `/api/followup/tasks/${taskIdFromParams}`,
            );
            if (data?.task || data) {
              setSelectedTask(data.task || data);
            }
          } catch (err) {
            console.error("Error fetching task details:", err);
          }
        })();
      }
    } else {
      setSelectedTask(null);
    }
  }, [taskIdFromParams, tasks]);

  const updateTaskStatus = async (taskId, status) => {
    try {
      await apiClient.patch(`/api/followup/tasks/${taskId}/status`, { status });

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
      await apiClient.post(`/api/followup/tasks/${taskId}/acknowledge`);

      toast.success("Task acknowledged");
      fetchTasks();
    } catch (error) {
      console.error("Error acknowledging task:", error);
      toast.error("Failed to acknowledge task");
    }
  };

  const handleSnooze = async (taskId, dateStr) => {
    try {
      await apiClient.patch(`/api/followup/tasks/${taskId}/snooze`, {
        snoozedUntil: dateStr,
      });
      toast.success("Task snoozed successfully");
      setSnoozeTaskItem(null);
      setCustomSnoozeDate("");
      fetchTasks();
      fetchAnalytics();
    } catch {
      toast.error("Failed to snooze task");
    }
  };

  const handleEscalate = async (taskId) => {
    try {
      await apiClient.post(`/api/followup/escalate/${taskId}`, {
        reason: escalateReason || "Manual escalation",
      });
      toast.success("Task escalated successfully!");
      setEscalateTaskItem(null);
      setEscalateReason("");
      fetchTasks();
      fetchAnalytics();
    } catch {
      toast.error("Failed to escalate task");
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
      snoozed:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    };
    return colors[status] || colors.pending;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      medium:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      high: "bg-orange-100 text-orange-850 dark:bg-orange-900/30 dark:text-orange-300",
      urgent: "bg-red-150 text-red-800 dark:bg-red-900/35 dark:text-red-350",
    };
    return colors[priority] || colors.medium;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntilDeadline = (deadlineString) => {
    if (!deadlineString) return 0;
    const deadline = new Date(deadlineString);
    const now = new Date();
    const diffTime = deadline - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#6b7280"];

  const getPieData = () => {
    if (!analytics) return [];
    return [
      { name: "In Progress", value: analytics.inProgressCount || 0 },
      { name: "Overdue", value: analytics.overdueCount || 0 },
      { name: "Completed", value: analytics.completedCount || 0 },
      { name: "Pending", value: analytics.pendingCount || 0 },
    ].filter((item) => item.value > 0);
  };

  const getRecentMetrics = () => {
    if (!analytics || !analytics.completionTrends) return [];
    return analytics.completionTrends.slice(-7).map((t) => ({
      date: t.date,
      Completed: t.completed,
      Created: t.created,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />

      <div className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Middle Column - Content & Dashboard */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Follow-Up Dashboard
            </h1>
            <p className="text-slate-650 dark:text-slate-400">
              Manage and automate action items with reminder preferences,
              snoozes, and escalation workflows.
            </p>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Clock}
              label="Pending Tasks"
              value={analytics?.pendingCount || 0}
              color="blue"
            />
            <MetricCard
              icon={AlertCircle}
              label="Overdue Tasks"
              value={analytics?.overdueCount || 0}
              color="red"
            />
            <MetricCard
              icon={CheckCircle}
              label="Completed"
              value={analytics?.completedCount || 0}
              color="green"
            />
            <MetricCard
              icon={TrendingUp}
              label="SLA Compliance"
              value={`${analytics?.complianceRate || 100}%`}
              subtitle="Completed within deadline"
              color="purple"
            />
          </div>

          {/* Charts Section */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                  Task Distribution
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getPieData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {getPieData().map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                  Activity (Last 7 Days)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getRecentMetrics()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Completed"
                        stroke="#10b981"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="Created"
                        stroke="#3b82f6"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Tasks Board Wrapper */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                Action Items Board
              </h2>
              <button
                onClick={fetchTasks}
                className="p-2 text-slate-550 hover:text-slate-850 dark:text-slate-350 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg border-0 bg-transparent cursor-pointer"
                title="Refresh tasks list"
              >
                <RefreshCw className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Status Filters bar */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
              {[
                "all",
                "pending",
                "in-progress",
                "completed",
                "overdue",
                "snoozed",
              ].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusFilterChange(status)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border-0 cursor-pointer transition-all ${
                    statusFilter === status
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {status === "all"
                    ? "All"
                    : status === "in-progress"
                      ? "In Progress"
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* Task List */}
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-650 dark:text-slate-400 text-sm">
                  Loading tasks...
                </p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-slate-650 dark:text-slate-400 text-sm font-medium">
                  {statusFilter === "all"
                    ? "No action items found"
                    : `No ${statusFilter} tasks`}
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {tasks.map((task) => {
                  const daysUntil = getDaysUntilDeadline(task.deadline);
                  const isOverdue = daysUntil < 0;

                  return (
                    <div
                      key={task._id}
                      className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 hover:shadow-md border border-slate-100 dark:border-slate-750 transition-shadow cursor-pointer"
                      onClick={() => navigate(`/followup/tasks/${task._id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
                                task.status,
                              )}`}
                            >
                              {task.status}
                            </span>
                            {task.metadata?.priority && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(
                                  task.metadata.priority,
                                )}`}
                              >
                                {task.metadata.priority}
                              </span>
                            )}
                            {!task.acknowledged &&
                              task.status === "pending" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-850 dark:bg-orange-950/40 dark:text-orange-300">
                                  New
                                </span>
                              )}
                            {task.snoozedUntil &&
                              new Date(task.snoozedUntil) > new Date() && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-850 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1">
                                  <BellOff size={10} /> Snoozed
                                </span>
                              )}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                            {task.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            From: {task.meeting?.title || "Meeting"}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>

                      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            <span>{formatDate(task.deadline)}</span>
                          </div>
                          {isOverdue && (
                            <div className="flex items-center gap-1 text-red-650 dark:text-red-400 font-semibold">
                              <AlertCircle className="w-4 h-4" />
                              <span>{Math.abs(daysUntil)} days overdue</span>
                            </div>
                          )}
                          {!isOverdue && daysUntil <= 7 && (
                            <div className="flex items-center gap-1 text-orange-650 dark:text-orange-400 font-semibold">
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
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-semibold cursor-pointer border-0 shadow-sm"
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
                              className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 font-semibold cursor-pointer border-0 shadow-sm"
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
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-semibold cursor-pointer border-0 shadow-sm"
                            >
                              Complete
                            </button>
                          )}
                          {task.status !== "completed" &&
                            task.status !== "cancelled" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSnoozeTaskItem(task);
                                }}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-lg font-semibold cursor-pointer border-0 shadow-sm flex items-center gap-1"
                                data-testid={`snooze-btn-${task._id}`}
                              >
                                <BellOff size={11} /> Snooze
                              </button>
                            )}
                          {isAdmin &&
                            task.status !== "completed" &&
                            task.status !== "cancelled" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEscalateTaskItem(task);
                                }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-semibold cursor-pointer border-0 shadow-sm flex items-center gap-1"
                                data-testid={`escalate-btn-${task._id}`}
                              >
                                <ChevronUp size={11} /> Escalate
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {(page - 1) * 20 + 1} to{" "}
                  {Math.min(page * 20, pagination.total)} of {pagination.total}{" "}
                  tasks
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border-0 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={page === pagination.totalPages}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border-0 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - SLA details & Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              SLA Policies
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              View how overdue items are tracked and escalated inside the
              organization.
            </p>
            <div className="space-y-4">
              <Link
                to="/sla-compliance"
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-semibold transition shadow-sm"
              >
                Go to SLA Compliance Dashboard
              </Link>
              <Link
                to="/escalations"
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition"
              >
                Go to Escalations Policy Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* TaskDetailsModal */}
      <TaskDetailsModal
        selectedTask={
          selectedTask
            ? {
                ...selectedTask,
                priority:
                  selectedTask.priority ||
                  selectedTask.metadata?.priority ||
                  "medium",
                dueDate: selectedTask.dueDate || selectedTask.deadline,
                owner:
                  selectedTask.owner ||
                  selectedTask.assignee?.name ||
                  selectedTask.assignee ||
                  "Unassigned",
                meetingTitle:
                  selectedTask.meetingTitle || selectedTask.meeting?.title,
                meetingId:
                  selectedTask.meetingId ||
                  selectedTask.meeting?._id ||
                  selectedTask.meeting,
              }
            : null
        }
        setSelectedTask={(task) => {
          setSelectedTask(task);
          if (!task && taskIdFromParams) {
            navigate("/followup");
          }
        }}
        navigate={navigate}
      />

      {/* Snooze Options Modal */}
      {snoozeTaskItem && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Snooze Action Item"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center pb-3 border-b border-slate-150 dark:border-slate-700 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BellOff className="text-amber-500" /> Snooze Task
              </h3>
              <button
                onClick={() => {
                  setSnoozeTaskItem(null);
                  setCustomSnoozeDate("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-0 bg-transparent text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Snooze <strong>"{snoozeTaskItem.title}"</strong> to temporarily
              hide it from your active task board. It will return automatically
              at the selected time.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setHours(date.getHours() + 1);
                  handleSnooze(snoozeTaskItem._id, date.toISOString());
                }}
                className="py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 cursor-pointer bg-transparent"
              >
                1 Hour
              </button>
              <button
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setHours(date.getHours() + 4);
                  handleSnooze(snoozeTaskItem._id, date.toISOString());
                }}
                className="py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 cursor-pointer bg-transparent"
              >
                4 Hours
              </button>
              <button
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 1);
                  handleSnooze(snoozeTaskItem._id, date.toISOString());
                }}
                className="py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 cursor-pointer bg-transparent"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 3);
                  handleSnooze(snoozeTaskItem._id, date.toISOString());
                }}
                className="py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 cursor-pointer bg-transparent"
              >
                3 Days
              </button>
            </div>

            <div className="space-y-2 mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Custom Wake Time
              </label>
              <input
                type="datetime-local"
                value={customSnoozeDate}
                onChange={(e) => setCustomSnoozeDate(e.target.value)}
                className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-150 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setSnoozeTaskItem(null);
                  setCustomSnoozeDate("");
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-650 rounded-lg text-sm text-slate-750 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer border-0"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!customSnoozeDate}
                onClick={() =>
                  handleSnooze(
                    snoozeTaskItem._id,
                    new Date(customSnoozeDate).toISOString(),
                  )
                }
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition cursor-pointer border-0"
              >
                Apply Snooze
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Reason Modal */}
      {escalateTaskItem && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Escalate Action Item"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center pb-3 border-b border-slate-150 dark:border-slate-700 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ChevronUp className="text-red-500" /> Escalate Task
              </h3>
              <button
                onClick={() => {
                  setEscalateTaskItem(null);
                  setEscalateReason("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-0 bg-transparent text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-650 dark:text-slate-400 mb-4">
              Escalate task <strong>"{escalateTaskItem.title}"</strong> to the
              organizational escalation queue. Specify the reason for manual
              escalation.
            </p>

            <div className="space-y-2 mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Escalation Reason
              </label>
              <textarea
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Reason for manual escalation (e.g. assignee is blocked or task is critical)"
                rows={3}
                className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-150 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setEscalateTaskItem(null);
                  setEscalateReason("");
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-650 rounded-lg text-sm text-slate-750 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer border-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleEscalate(escalateTaskItem._id)}
                className="px-4 py-2 bg-red-650 hover:bg-red-750 text-white rounded-lg text-sm font-semibold transition cursor-pointer border-0"
              >
                Confirm Escalation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ icon, label, value, subtitle, color }) => {
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
