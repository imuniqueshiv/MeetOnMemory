import { z } from "zod";
import mongoose from "mongoose";
import ActionItem from "../models/actionItemModel.js";
import ActionItemExtractor from "../services/actionItemExtractor.js";
import { syncActionItemToGitHub } from "../services/githubSyncService.js";
import { syncActionItemToJira } from "../services/jiraSyncService.js";
import { syncActionItemToLinear } from "../services/linearSyncService.js";
import eventBus from "../services/eventBus.js";
import ActionItemChangeLog from "../models/actionItemChangeLogModel.js";

/**
 * @desc Trigger AI extraction from meeting transcript (Idempotent)
 */
export const extractFromMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Idempotency check: Prevent duplicate extractions
    const existingCount = await ActionItem.countDocuments({
      $or: [{ sourceMeetingId: meetingId }, { meetingId }],
      aiConfidence: { $exists: true },
    });
    if (existingCount > 0) {
      return res.status(400).json({
        success: false,
        error: "Action items have already been extracted for this meeting.",
      });
    }

    const meeting = req.meeting; // Populated by verifyMeetingAccess
    if (!meeting.transcript || meeting.transcript.length < 100) {
      return res
        .status(400)
        .json({ success: false, error: "Transcript is too short." });
    }

    const extractedItems = await ActionItemExtractor.extractFromTranscript(
      meeting.transcript,
      meeting.participants,
    );

    // Explicitly handle state initialization since insertMany bypasses pre('save')
    const now = new Date();
    const itemsToInsert = extractedItems.map((item) => {
      let status = "pending";
      if (item.deadline && new Date(item.deadline) < now) status = "overdue";

      return {
        ...item,
        text: item.text || item.title || "",
        sourceMeetingId: meetingId,
        assignedBy: userId,
        status,
        completedAt: null,
      };
    });

    const savedItems = await ActionItem.insertMany(itemsToInsert);

    // Sync with Issue Trackers
    try {
      if (process.env.NODE_ENV !== "test") {
        // Fire and forget in production to avoid blocking response
        savedItems.forEach((item) => {
          syncActionItemToGitHub(item).catch((err) =>
            console.error("GitHub Sync Error:", err),
          );
          syncActionItemToJira(item).catch((err) =>
            console.error("Jira Sync Error:", err),
          );
          syncActionItemToLinear(item).catch((err) =>
            console.error("Linear Sync Error:", err),
          );
        });
      } else {
        // Await in test to prevent Jest teardown errors
        await Promise.allSettled(
          savedItems.map((item) =>
            Promise.all([
              syncActionItemToGitHub(item),
              syncActionItemToJira(item),
              syncActionItemToLinear(item),
            ]),
          ),
        );
      }
    } catch (err) {
      console.error("Failed to sync to issue trackers:", err);
    }

    res
      .status(201)
      .json({ success: true, count: savedItems.length, data: savedItems });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: error.message || "Server error" });
  }
};

/**
 * @desc Create a manual action item for a meeting
 * @route POST /api/action-items
 * @access Private
 */
const createActionItemSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Action item text is required")
      .max(2000)
      .optional(),
    title: z
      .string()
      .trim()
      .min(1, "Action item title is required")
      .max(2000)
      .optional(),
    description: z.string().trim().max(2000).optional(),
    assignee: z.string().trim().optional().nullable(),
    status: z
      .enum([
        "open",
        "in-progress",
        "resolved",
        "superseded",
        "pending",
        "in_progress",
        "completed",
        "overdue",
        "cancelled",
      ])
      .optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    dueDate: z.union([z.string(), z.date()]).optional().nullable(),
    deadline: z.union([z.string(), z.date()]).optional().nullable(),
    sourceContext: z.string().max(5000).optional(),
    remindersEnabled: z.boolean().optional(),
  })
  .refine((data) => data.text || data.title, {
    message: "Action item text is required",
    path: ["text"],
  });

export const createActionItem = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const parsed = createActionItemSchema.safeParse(req.body);

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid meeting ID",
      });
    }

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        errors: parsed.error.issues,
      });
    }

    const data = parsed.data;
    const text = data.text || data.title;
    const dueDate = data.dueDate ?? data.deadline ?? null;

    if (dueDate !== null && Number.isNaN(new Date(dueDate).getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid due date",
      });
    }

    if (data.assignee && !mongoose.isValidObjectId(data.assignee)) {
      return res.status(400).json({
        success: false,
        error: "Invalid assignee ID",
      });
    }

    const item = await ActionItem.create({
      text,
      description: data.description || "",
      assignee: data.assignee || null,
      assignedBy: req.user._id || req.user.id,
      status: data.status || "open",
      priority: data.priority || "medium",
      sourceMeetingId: meetingId,
      organization:
        req.meeting.organization ||
        req.meeting.organizationId ||
        req.user.organization ||
        req.user.organizationId ||
        null,
      dueDate,
      sourceContext: data.sourceContext || "",
      remindersEnabled: data.remindersEnabled ?? true,
    });

    const populatedItem = await ActionItem.findById(item._id)
      .populate("assignee", "name avatar")
      .populate("assignedBy", "name")
      .populate("sourceMeetingId", "title date");

    return res.status(201).json({
      success: true,
      data: populatedItem || item,
    });
  } catch (error) {
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    console.error("Error creating action item:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

/**
 * @desc Get action items for the current user
 */
export const getActionItems = async (req, res) => {
  try {
    const { status, priority, meetingId } = req.query;
    const userId = req.user._id || req.user.id;
    const orgId = req.user.organization || req.user.organizationId;

    const filter = {
      $or: [{ assignee: userId }, { assignedBy: userId }],
      sourceMeetingId: { $in: await getOrgMeetingIds(orgId) }, // Scope to org
    };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (meetingId) filter.sourceMeetingId = meetingId;

    const items = await ActionItem.find(filter)
      .sort({ dueDate: 1, priority: -1 })
      .populate("assignee", "name avatar")
      .populate("assignedBy", "name")
      .populate("sourceMeetingId", "title date");

    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * @desc Get action items for a specific meeting
 */
export const getMeetingActionItems = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const items = await ActionItem.find({
      $or: [{ sourceMeetingId: meetingId }, { meetingId }],
    })
      .sort({ createdAt: 1 })
      .populate("assignee", "name avatar")
      .populate("assignedBy", "name");

    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * @desc Update action item (Whitelisted fields, explicit state transitions)
 */
export const updateActionItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = req.actionItem; // Populated by verifyActionItemAccess

    // Whitelist mutable fields
    const allowedFields = [
      "status",
      "assignee",
      "deadline",
      "dueDate",
      "priority",
      "title",
      "text",
      "description",
    ];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (updates.title && !updates.text) {
      updates.text = updates.title;
    }
    if (updates.deadline && !updates.dueDate) {
      updates.dueDate = updates.deadline;
    }

    // Explicit state transitions
    if (updates.status) {
      if (
        ["completed", "resolved"].includes(updates.status) &&
        !["completed", "resolved"].includes(item.status)
      ) {
        updates.completedAt = new Date();
      } else if (!["completed", "resolved"].includes(updates.status)) {
        updates.completedAt = null;
      }

      // Auto-mark overdue if deadline passed and not completed/cancelled
      const targetDate = updates.dueDate || updates.deadline || item.dueDate;
      if (
        targetDate &&
        new Date(targetDate) < new Date() &&
        !["completed", "resolved", "cancelled"].includes(updates.status)
      ) {
        updates.status = "overdue";
      }
    }

    const updatedItem = await ActionItem.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate("assignee", "name avatar");

    // --- Changelog Tracking ---
    try {
      const changelogEntries = [];
      const fieldsToTrack = [
        "status",
        "assignee",
        "dueDate",
        "priority",
        "title",
        "text",
        "description",
      ];
      const actingUserId = req.user._id || req.user.id;

      fieldsToTrack.forEach((field) => {
        let oldValue = item[field];
        let newValue = updatedItem[field];

        if (field === "assignee") {
          oldValue = item.assignee?._id
            ? item.assignee._id.toString()
            : item.assignee
              ? item.assignee.toString()
              : null;
          newValue = updatedItem.assignee?._id
            ? updatedItem.assignee._id.toString()
            : updatedItem.assignee
              ? updatedItem.assignee.toString()
              : null;
        } else if (field === "dueDate") {
          oldValue = oldValue ? new Date(oldValue).toISOString() : null;
          newValue = newValue ? new Date(newValue).toISOString() : null;
        }

        if (oldValue !== newValue) {
          changelogEntries.push({
            actionItemId: updatedItem._id,
            changedBy: actingUserId,
            changeType: field,
            oldValue,
            newValue,
          });
        }
      });

      if (changelogEntries.length > 0) {
        await ActionItemChangeLog.insertMany(changelogEntries);
      }
    } catch (changelogErr) {
      console.error("Failed to create action item changelog", changelogErr);
    }
    // -------------------------

    if (["completed", "resolved"].includes(updates.status)) {
      eventBus.emit("actionItem.completed", {
        userId: updatedItem.assignee?._id || req.user.id,
        organizationId: req.user.organization || req.user.organizationId,
        actionItemId: updatedItem._id,
      });
    }

    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

/**
 * @desc Delete an action item
 */
export const deleteActionItem = async (req, res) => {
  try {
    await ActionItem.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Helper to get meeting IDs for an org
async function getOrgMeetingIds(orgId) {
  const Meeting = (await import("../models/meetingModel.js")).default;
  const meetings = await Meeting.find({
    $or: [{ organization: orgId }, { organizationId: orgId }],
  }).select("_id");
  return meetings.map((m) => m._id);
}
