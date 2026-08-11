import FollowUpTask from "../models/FollowUpTask.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import { createNotification } from "./notificationService.js";
import EmailService from "./EmailService.js";

/**
 * Follow-Up Workflow Service
 * Manages automated follow-up workflows for action items including
 * reminders, escalations, and completion tracking
 */

/**
 * Create follow-up task from action item
 * @param {Object} actionItem - Action item document
 * @param {Object} meeting - Meeting document
 * @returns {Object} Created follow-up task
 */
export const createFollowUpTask = async (actionItem, meeting) => {
  try {
    // Check if follow-up task already exists
    const existing = await FollowUpTask.findOne({ actionItem: actionItem._id });
    if (existing) {
      console.log(
        `Follow-up task already exists for action item ${actionItem._id}`,
      );
      return existing;
    }

    // Find assignee user
    let assigneeId = null;
    if (actionItem.owner && actionItem.owner !== "Unassigned") {
      const assignee = await User.findOne({
        $or: [{ email: actionItem.owner }, { name: actionItem.owner }],
      });
      assigneeId = assignee?._id;
    }

    if (!assigneeId) {
      console.warn(`No assignee found for action item: ${actionItem.text}`);
      return null;
    }

    // Calculate deadline (default: 7 days from meeting date)
    const meetingDate = meeting.date ? new Date(meeting.date) : new Date();
    const deadline =
      actionItem.dueDate ||
      new Date(meetingDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Create follow-up task
    const followUpTask = new FollowUpTask({
      actionItem: actionItem._id,
      meeting: meeting._id,
      assignee: assigneeId,
      organization: meeting.organization,
      title: actionItem.text,
      description: actionItem.description || "",
      deadline,
      status: "pending",
      metadata: {
        priority: actionItem.priority || "medium",
        estimatedHours: actionItem.estimatedHours || null,
      },
    });

    await followUpTask.save();

    // Schedule reminders
    await followUpTask.scheduleReminders();

    // Send initial assignment notification
    await sendAssignmentNotification(followUpTask);

    console.log(
      `✅ Created follow-up task for action item: ${actionItem.text}`,
    );
    return followUpTask;
  } catch (error) {
    console.error("Error creating follow-up task:", error);
    throw error;
  }
};

/**
 * Send assignment notification to assignee
 * @param {Object} task - Follow-up task
 */
const sendAssignmentNotification = async (task) => {
  try {
    await task.populate("meeting", "title date");
    await task.populate("assignee", "name email");

    const meetingTitle = task.meeting?.title || "Meeting";
    const deadlineStr = task.deadline.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Create in-app notification
    await createNotification(
      task.assignee._id,
      "New Action Item Assigned",
      `You've been assigned a new action item from "${meetingTitle}": "${task.title}". Deadline: ${deadlineStr}`,
      "tasks",
      `/followup/tasks/${task._id}`,
      "View Task",
      { taskId: task._id, meetingId: task.meeting._id },
    );

    // Send email notification
    await sendTaskAssignmentEmail(task);

    console.log(`✅ Assignment notification sent to ${task.assignee.email}`);
  } catch (error) {
    console.error("Error sending assignment notification:", error);
  }
};

/**
 * Send task assignment email
 * @param {Object} task - Follow-up task
 */
const sendTaskAssignmentEmail = async (task) => {
  try {
    const meetingTitle = task.meeting?.title || "Meeting";
    const deadlineStr = task.deadline.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">New Action Item Assigned</h2>
        <p>Hi ${task.assignee.name},</p>
        <p>You've been assigned a new action item from <strong>${meetingTitle}</strong>:</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 0 0 8px 0; font-weight: bold;">${task.title}</p>
          ${task.description ? `<p style="margin: 0; color: #64748b;">${task.description}</p>` : ""}
        </div>
        <p><strong>Deadline:</strong> ${deadlineStr}</p>
        <p><strong>Priority:</strong> ${task.metadata?.priority || "Medium"}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/followup/tasks/${task._id}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">View Task</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #666;">This is an automated notification from MeetOnMemory.</p>
      </div>
    `;

    await EmailService.sendMail({
      from: process.env.SENDER_EMAIL || "no-reply@meetonmemory.com",
      to: task.assignee.email,
      subject: `New Action Item: ${task.title}`,
      html,
    });
  } catch (error) {
    console.error("Error sending task assignment email:", error);
  }
};

/**
 * Process reminders for due tasks
 * @returns {Object} Summary of processed reminders
 */
export const processReminders = async () => {
  try {
    const now = new Date();
    const summary = {
      processed: 0,
      sent: 0,
      errors: 0,
    };

    // Find tasks with unsent reminders that are due
    const tasks = await FollowUpTask.find({
      "reminders.scheduledFor": { $lte: now },
      "reminders.sent": false,
      status: { $in: ["pending", "in-progress"] },
    })
      .populate("assignee", "name email")
      .populate("meeting", "title date")
      .limit(100);

    for (const task of tasks) {
      try {
        const dueReminders = task.reminders.filter(
          (r) => !r.sent && r.scheduledFor <= now,
        );

        for (const reminder of dueReminders) {
          await sendReminderNotification(task, reminder);
          reminder.sent = true;
          reminder.sentAt = new Date();
          summary.sent++;
        }

        task.lastRemindedAt = now;
        task.reminderCount += dueReminders.length;
        await task.save();
        summary.processed++;
      } catch (error) {
        console.error(
          `Error processing reminders for task ${task._id}:`,
          error,
        );
        summary.errors++;
      }
    }

    console.log(
      `✅ Processed ${summary.processed} tasks, sent ${summary.sent} reminders`,
    );
    return summary;
  } catch (error) {
    console.error("Error in processReminders:", error);
    throw error;
  }
};

/**
 * Send reminder notification
 * @param {Object} task - Follow-up task
 * @param {Object} reminder - Reminder object
 */
const sendReminderNotification = async (task, reminder) => {
  try {
    const meetingTitle = task.meeting?.title || "Meeting";
    const deadlineStr = task.deadline.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const timeUntilDeadline = task.deadline.getTime() - Date.now();
    const hoursUntilDeadline = Math.round(timeUntilDeadline / (1000 * 60 * 60));

    let urgencyLevel = "normal";
    if (hoursUntilDeadline < 1) urgencyLevel = "critical";
    else if (hoursUntilDeadline < 12) urgencyLevel = "high";
    else if (hoursUntilDeadline < 24) urgencyLevel = "medium";

    const title =
      reminder.type === "pre-deadline-24h"
        ? "Action Item Due Tomorrow"
        : reminder.type === "pre-deadline-12h"
          ? "Action Item Due in 12 Hours"
          : reminder.type === "pre-deadline-1h"
            ? "Action Item Due in 1 Hour"
            : "Action Item Reminder";

    const description = `"${task.title}" from ${meetingTitle} is due ${deadlineStr}. ${
      hoursUntilDeadline > 0
        ? `${hoursUntilDeadline} hours remaining.`
        : "Overdue!"
    }`;

    // Create in-app notification
    await createNotification(
      task.assignee._id,
      title,
      description,
      "tasks",
      `/followup/tasks/${task._id}`,
      "View Task",
      { taskId: task._id, reminderType: reminder.type, urgency: urgencyLevel },
    );

    // Send email for urgent reminders
    if (urgencyLevel === "high" || urgencyLevel === "critical") {
      await sendReminderEmail(task, reminder, urgencyLevel);
    }

    console.log(`✅ Sent ${reminder.type} reminder to ${task.assignee.email}`);
  } catch (error) {
    console.error("Error sending reminder notification:", error);
  }
};

/**
 * Send reminder email
 * @param {Object} task - Follow-up task
 * @param {Object} reminder - Reminder object
 * @param {String} urgencyLevel - Urgency level
 */
const sendReminderEmail = async (task, reminder, urgencyLevel) => {
  try {
    const meetingTitle = task.meeting?.title || "Meeting";
    const deadlineStr = task.deadline.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const timeUntilDeadline = task.deadline.getTime() - Date.now();
    const hoursUntilDeadline = Math.round(timeUntilDeadline / (1000 * 60 * 60));

    const urgencyColor =
      urgencyLevel === "critical"
        ? "#dc2626"
        : urgencyLevel === "high"
          ? "#f59e0b"
          : "#2563eb";

    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <div style="background: ${urgencyColor}; color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <h2 style="margin: 0;">⏰ Action Item Reminder</h2>
        </div>
        <p>Hi ${task.assignee.name},</p>
        <p>This is a reminder about your action item from <strong>${meetingTitle}</strong>:</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${urgencyColor};">
          <p style="margin: 0 0 8px 0; font-weight: bold;">${task.title}</p>
          ${task.description ? `<p style="margin: 0; color: #64748b;">${task.description}</p>` : ""}
        </div>
        <p><strong>Deadline:</strong> ${deadlineStr}</p>
        <p><strong>Time Remaining:</strong> ${
          hoursUntilDeadline > 0 ? `${hoursUntilDeadline} hours` : "Overdue"
        }</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/followup/tasks/${task._id}" style="display: inline-block; padding: 12px 24px; background-color: ${urgencyColor}; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">View Task</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #666;">This is an automated reminder from MeetOnMemory.</p>
      </div>
    `;

    await EmailService.sendMail({
      from: process.env.SENDER_EMAIL || "no-reply@meetonmemory.com",
      to: task.assignee.email,
      subject: `[${urgencyLevel.toUpperCase()}] Reminder: ${task.title}`,
      html,
    });
  } catch (error) {
    console.error("Error sending reminder email:", error);
  }
};

/**
 * Process overdue tasks and trigger escalations
 * @returns {Object} Summary of escalations
 */
export const processOverdueTasks = async () => {
  try {
    const now = new Date();
    const summary = {
      processed: 0,
      escalated: 0,
      errors: 0,
    };

    // Find overdue tasks that haven't been escalated recently
    const overdueTasks = await FollowUpTask.find({
      deadline: { $lt: now },
      status: { $in: ["pending", "in-progress"] },
      $or: [
        { escalations: { $size: 0 } },
        {
          "escalations.escalatedAt": {
            $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
      ],
    })
      .populate("assignee", "name email")
      .populate("meeting", "title date")
      .limit(100);

    for (const task of overdueTasks) {
      try {
        // Update status to overdue
        if (task.status !== "overdue") {
          task.status = "overdue";
          await task.save();
        }

        // Check if escalation is enabled
        if (!task.reminderPreferences.escalationEnabled) {
          continue;
        }

        // Determine escalation level
        const daysOverdue = Math.floor(
          (now.getTime() - task.deadline.getTime()) / (1000 * 60 * 60 * 24),
        );

        let escalationLevel = 1;
        if (daysOverdue >= 7) escalationLevel = 3;
        else if (daysOverdue >= 3) escalationLevel = 2;

        // Find manager to escalate to
        const organization = await Organization.findById(task.organization);
        if (!organization) continue;

        // Escalate to organization owner/admin
        const managers = await User.find({
          organization: task.organization,
          role: { $in: ["owner", "admin"] },
        }).limit(5);

        for (const manager of managers) {
          if (manager._id.toString() !== task.assignee._id.toString()) {
            await escalateTask(task, manager, escalationLevel, daysOverdue);
            summary.escalated++;
            break; // Only escalate to one manager per cycle
          }
        }

        summary.processed++;
      } catch (error) {
        console.error(`Error processing overdue task ${task._id}:`, error);
        summary.errors++;
      }
    }

    console.log(
      `✅ Processed ${summary.processed} overdue tasks, escalated ${summary.escalated}`,
    );
    return summary;
  } catch (error) {
    console.error("Error in processOverdueTasks:", error);
    throw error;
  }
};

/**
 * Escalate task to manager
 * @param {Object} task - Follow-up task
 * @param {Object} manager - Manager user
 * @param {Number} level - Escalation level
 * @param {Number} daysOverdue - Days overdue
 */
const escalateTask = async (task, manager, level, daysOverdue) => {
  try {
    const meetingTitle = task.meeting?.title || "Meeting";

    const reason = `Task is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`;

    // Add escalation record
    await task.escalate(manager._id, reason, level);

    // Notify manager
    await createNotification(
      manager._id,
      `⚠️ Overdue Task Escalation (Level ${level})`,
      `"${task.title}" assigned to ${task.assignee.name} is ${daysOverdue} day${
        daysOverdue !== 1 ? "s" : ""
      } overdue from ${meetingTitle}.`,
      "tasks",
      `/followup/tasks/${task._id}`,
      "Review Task",
      {
        taskId: task._id,
        assigneeId: task.assignee._id,
        escalationLevel: level,
        daysOverdue,
      },
    );

    // Send escalation email
    await sendEscalationEmail(task, manager, level, daysOverdue);

    // Notify assignee about escalation
    await createNotification(
      task.assignee._id,
      "Task Escalated to Manager",
      `Your task "${task.title}" has been escalated due to being overdue. Please complete it as soon as possible.`,
      "tasks",
      `/followup/tasks/${task._id}`,
      "View Task",
      { taskId: task._id, escalationLevel: level },
    );

    console.log(
      `✅ Escalated task ${task._id} to ${manager.email} (Level ${level})`,
    );
  } catch (error) {
    console.error("Error escalating task:", error);
  }
};

/**
 * Send escalation email
 * @param {Object} task - Follow-up task
 * @param {Object} manager - Manager user
 * @param {Number} level - Escalation level
 * @param {Number} daysOverdue - Days overdue
 */
const sendEscalationEmail = async (task, manager, level, daysOverdue) => {
  try {
    const meetingTitle = task.meeting?.title || "Meeting";
    const deadlineStr = task.deadline.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const levelColor =
      level === 3 ? "#dc2626" : level === 2 ? "#f59e0b" : "#3b82f6";

    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <div style="background: ${levelColor}; color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <h2 style="margin: 0;">⚠️ Task Escalation - Level ${level}</h2>
        </div>
        <p>Hi ${manager.name},</p>
        <p>An overdue task has been escalated to your attention:</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${levelColor};">
          <p style="margin: 0 0 8px 0;"><strong>Task:</strong> ${task.title}</p>
          <p style="margin: 0 0 8px 0;"><strong>Assigned to:</strong> ${task.assignee.name} (${task.assignee.email})</p>
          <p style="margin: 0 0 8px 0;"><strong>Meeting:</strong> ${meetingTitle}</p>
          <p style="margin: 0 0 8px 0;"><strong>Deadline:</strong> ${deadlineStr}</p>
          <p style="margin: 0; color: ${levelColor}; font-weight: bold;">${daysOverdue} day${
            daysOverdue !== 1 ? "s" : ""
          } overdue</p>
        </div>
        ${
          task.description
            ? `<p><strong>Description:</strong> ${task.description}</p>`
            : ""
        }
        <p>Please follow up with the assignee to ensure this task is completed.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/followup/tasks/${task._id}" style="display: inline-block; padding: 12px 24px; background-color: ${levelColor}; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Review Task</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #666;">This is an automated escalation from MeetOnMemory.</p>
      </div>
    `;

    await EmailService.sendMail({
      from: process.env.SENDER_EMAIL || "no-reply@meetonmemory.com",
      to: manager.email,
      subject: `[ESCALATION Level ${level}] Overdue Task: ${task.title}`,
      html,
    });
  } catch (error) {
    console.error("Error sending escalation email:", error);
  }
};

/**
 * Get completion analytics for organization
 * @param {String} organizationId - Organization ID
 * @param {Object} filters - Optional filters
 * @returns {Object} Analytics data
 */
export const getCompletionAnalytics = async (organizationId, filters = {}) => {
  try {
    const query = { organization: organizationId };

    if (filters.startDate) {
      query.createdAt = { $gte: new Date(filters.startDate) };
    }

    if (filters.endDate) {
      query.createdAt = { $lte: new Date(filters.endDate) };
    }

    const allTasks = await FollowUpTask.find(query)
      .populate("assignee", "name email")
      .populate("meeting", "title date");

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "completed");
    const overdueTasks = allTasks.filter((t) => t.status === "overdue");
    const pendingTasks = allTasks.filter((t) => t.status === "pending");
    const inProgressTasks = allTasks.filter((t) => t.status === "in-progress");

    // Calculate completion rate
    const completionRate =
      totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

    // Calculate average time to completion
    const completedWithTime = completedTasks.filter(
      (t) => t.completedAt && t.createdAt,
    );
    const avgTimeToCompletion =
      completedWithTime.length > 0
        ? completedWithTime.reduce((sum, t) => {
            const timeDiff = t.completedAt.getTime() - t.createdAt.getTime();
            return sum + timeDiff / (1000 * 60 * 60 * 24); // days
          }, 0) / completedWithTime.length
        : 0;

    // Calculate overdue rate
    const overdueRate =
      totalTasks > 0 ? (overdueTasks.length / totalTasks) * 100 : 0;

    // Calculate on-time completion rate
    const onTimeCompletions = completedTasks.filter(
      (t) => t.completedAt <= t.deadline,
    );
    const onTimeRate =
      completedTasks.length > 0
        ? (onTimeCompletions.length / completedTasks.length) * 100
        : 0;

    // Group by assignee
    const assigneeStats = {};
    allTasks.forEach((task) => {
      const assigneeId = task.assignee._id.toString();
      if (!assigneeStats[assigneeId]) {
        assigneeStats[assigneeId] = {
          assignee: task.assignee,
          total: 0,
          completed: 0,
          overdue: 0,
          avgCompletionTime: 0,
        };
      }
      assigneeStats[assigneeId].total++;
      if (task.status === "completed") {
        assigneeStats[assigneeId].completed++;
        if (task.completedAt && task.createdAt) {
          const timeDiff =
            (task.completedAt.getTime() - task.createdAt.getTime()) /
            (1000 * 60 * 60 * 24);
          assigneeStats[assigneeId].avgCompletionTime += timeDiff;
        }
      }
      if (task.status === "overdue") {
        assigneeStats[assigneeId].overdue++;
      }
    });

    // Calculate averages for assignees
    Object.values(assigneeStats).forEach((stat) => {
      if (stat.completed > 0) {
        stat.avgCompletionTime /= stat.completed;
      }
      stat.completionRate =
        stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
    });

    return {
      summary: {
        totalTasks,
        completedTasks: completedTasks.length,
        overdueTasks: overdueTasks.length,
        pendingTasks: pendingTasks.length,
        inProgressTasks: inProgressTasks.length,
        completionRate: Math.round(completionRate * 100) / 100,
        overdueRate: Math.round(overdueRate * 100) / 100,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        avgTimeToCompletion: Math.round(avgTimeToCompletion * 100) / 100,
      },
      assigneeStats: Object.values(assigneeStats).sort(
        (a, b) => b.completionRate - a.completionRate,
      ),
      trends: calculateTrends(allTasks),
    };
  } catch (error) {
    console.error("Error getting completion analytics:", error);
    throw error;
  }
};

/**
 * Calculate trends over time
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Trend data
 */
const calculateTrends = (tasks) => {
  const weekMap = new Map();

  tasks.forEach((task) => {
    const weekStart = new Date(task.createdAt);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        week: weekKey,
        created: 0,
        completed: 0,
        overdue: 0,
      });
    }

    const weekData = weekMap.get(weekKey);
    weekData.created++;

    if (task.status === "completed") {
      weekData.completed++;
    } else if (task.status === "overdue") {
      weekData.overdue++;
    }
  });

  return Array.from(weekMap.values()).sort(
    (a, b) => new Date(a.week) - new Date(b.week),
  );
};

/**
 * Update task status
 * @param {String} taskId - Task ID
 * @param {String} status - New status
 * @param {String} userId - User ID making the change
 * @returns {Object} Updated task
 */
export const updateTaskStatus = async (taskId, status, userId) => {
  try {
    const task = await FollowUpTask.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    if (status === "completed") {
      await task.markCompleted(userId);

      // Send completion notification
      await createNotification(
        task.assignee,
        "Task Completed",
        `Great job! You've completed "${task.title}".`,
        "tasks",
        `/followup/tasks/${task._id}`,
        "View Task",
        { taskId: task._id },
      );
    } else {
      task.status = status;
      await task.save();
    }

    return task;
  } catch (error) {
    console.error("Error updating task status:", error);
    throw error;
  }
};

export default {
  createFollowUpTask,
  processReminders,
  processOverdueTasks,
  getCompletionAnalytics,
  updateTaskStatus,
};
