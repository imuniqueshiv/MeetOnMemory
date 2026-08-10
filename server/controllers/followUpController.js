import FollowUpTask from "../models/FollowUpTask.js";
import {
  getCompletionAnalytics,
  updateTaskStatus,
} from "../services/followUpWorkflowService.js";
import mongoose from "mongoose";

/**
 * Follow-Up Controller
 * Handles HTTP requests for follow-up workflow endpoints
 */

/**
 * @desc Get all follow-up tasks for user
 * @route GET /api/followup/tasks
 * @access Private
 */
export const getTasks = async (req, res) => {
  try {
    const { status, assignee, page = 1, limit = 20 } = req.query;
    const userId = req.user._id;
    const organizationId = req.user.organization;

    const query = { organization: organizationId };

    // Filter by assignee (default to current user)
    if (assignee) {
      query.assignee = assignee;
    } else {
      query.assignee = userId;
    }

    // Filter by status
    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await FollowUpTask.find(query)
      .populate("assignee", "name email profilePicture")
      .populate("meeting", "title date")
      .populate("completedBy", "name email")
      .sort({ deadline: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FollowUpTask.countDocuments(query);

    res.status(200).json({
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get specific follow-up task
 * @route GET /api/followup/tasks/:id
 * @access Private
 */
export const getTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await FollowUpTask.findById(id)
      .populate("assignee", "name email profilePicture")
      .populate("meeting", "title date participants")
      .populate("completedBy", "name email")
      .populate("actionItem");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check organization access
    if (task.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Update task status
 * @route PATCH /api/followup/tasks/:id/status
 * @access Private
 */
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const validStatuses = [
      "pending",
      "in-progress",
      "completed",
      "overdue",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await updateTaskStatus(id, status, req.user._id);

    res.status(200).json(task);
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Acknowledge task assignment
 * @route POST /api/followup/tasks/:id/acknowledge
 * @access Private
 */
export const acknowledgeTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await FollowUpTask.findById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Verify user is the assignee
    if (task.assignee.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not the task assignee" });
    }

    await task.acknowledge();

    res.status(200).json({ message: "Task acknowledged", task });
  } catch (error) {
    console.error("Error acknowledging task:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get reminder schedule
 * @route GET /api/followup/reminders
 * @access Private
 */
export const getReminders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user._id;

    const query = { assignee: userId };

    if (startDate || endDate) {
      query["reminders.scheduledFor"] = {};
      if (startDate) query["reminders.scheduledFor"].$gte = new Date(startDate);
      if (endDate) query["reminders.scheduledFor"].$lte = new Date(endDate);
    }

    const tasks = await FollowUpTask.find(query)
      .populate("meeting", "title")
      .select("title deadline reminders")
      .sort({ deadline: 1 });

    // Flatten reminders
    const reminders = tasks.flatMap((task) =>
      task.reminders.map((r) => ({
        ...r.toObject(),
        taskTitle: task.title,
        taskDeadline: task.deadline,
        taskId: task._id,
      })),
    );

    res.status(200).json(reminders);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Update reminder preferences
 * @route PUT /api/followup/reminders
 * @access Private
 */
export const updateReminderPreferences = async (req, res) => {
  try {
    const { taskId, preferences } = req.body;

    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await FollowUpTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Verify user is the assignee
    if (task.assignee.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not the task assignee" });
    }

    // Update preferences
    if (preferences) {
      task.reminderPreferences = {
        ...task.reminderPreferences,
        ...preferences,
      };
    }

    // Reschedule reminders
    await task.scheduleReminders();

    res.status(200).json({ message: "Preferences updated", task });
  } catch (error) {
    console.error("Error updating reminder preferences:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get completion analytics
 * @route GET /api/followup/analytics
 * @access Private
 */
export const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const organizationId = req.user.organization;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const analytics = await getCompletionAnalytics(organizationId, filters);

    res.status(200).json(analytics);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Manually escalate overdue task
 * @route POST /api/followup/escalate/:id
 * @access Private (Admin/Owner)
 */
export const escalateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    // Check if user is admin/owner
    if (req.user.role !== "admin" && req.user.role !== "owner") {
      return res
        .status(403)
        .json({ message: "Forbidden: Admin access required" });
    }

    const task = await FollowUpTask.findById(id).populate(
      "assignee",
      "name email",
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Escalate to current user
    await task.escalate(req.user._id, reason || "Manual escalation", 3);

    res.status(200).json({ message: "Task escalated", task });
  } catch (error) {
    console.error("Error escalating task:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Trigger manual reminder processing
 * @route POST /api/followup/process-reminders
 * @access Private (Admin)
 */
export const processRemindersManually = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "owner") {
      return res
        .status(403)
        .json({ message: "Forbidden: Admin access required" });
    }

    const { processReminders } =
      await import("../services/followUpWorkflowService.js");
    const summary = await processReminders();

    res.status(200).json({ message: "Reminders processed", summary });
  } catch (error) {
    console.error("Error processing reminders:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
