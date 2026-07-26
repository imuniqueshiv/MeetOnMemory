import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  GitMerge,
} from "lucide-react";
import useTasks from "../hooks/useTasks";
import TaskFilterPanel from "../components/tasks/TaskFilterPanel";
import TaskSortBar from "../components/tasks/TaskSortBar";
import TaskCard from "../components/tasks/TaskCard";
import TaskDetailsModal from "../components/tasks/TaskDetailsModal";

const Tasks = () => {
  const navigate = useNavigate();
  const taskState = useTasks();

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

        <TaskFilterPanel {...taskState} />
        <TaskSortBar
          sortBy={taskState.sortBy}
          sortOrder={taskState.sortOrder}
          handleSort={taskState.handleSort}
        />

        {/* Tasks List */}
        {taskState.loading ? (
          <div className="flex flex-col items-center justify-center py-20 fade-in-up">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              Loading tasks...
            </p>
          </div>
        ) : taskState.error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center fade-in-up">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Error Loading Tasks
            </h3>
            <p className="text-red-700">{taskState.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : taskState.sortedTasks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center fade-in-up">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {taskState.hasActiveFilters
                ? "No tasks match your filters"
                : "No action items yet"}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {taskState.hasActiveFilters
                ? "Try adjusting your filters or search terms"
                : "Upload and transcribe meetings to generate action items"}
            </p>
            {!taskState.hasActiveFilters && (
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
            {taskState.sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                setSelectedTask={taskState.setSelectedTask}
                navigate={navigate}
              />
            ))}
          </div>
        )}

        <TaskDetailsModal
          selectedTask={taskState.selectedTask}
          setSelectedTask={taskState.setSelectedTask}
          navigate={navigate}
        />
      </main>
    </div>
  );
};

export default Tasks;
