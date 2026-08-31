import mongoose from "mongoose";
import { z } from "zod";

import MeetingChecklist from "../models/meetingChecklistModel.js";
import Meeting from "../models/meetingModel.js";
import { canAccessMeetingDoc } from "../middleware/rbac.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import { isSameOrganization } from "../utils/organizationScope.js";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "../utils/errors.js";
import { sendSuccess } from "../utils/responseHandler.js";

const createChecklistSchema = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1, "Item text is required"),
        description: z.string().optional(),
        required: z.boolean().optional(),
        assignee: z
          .string()
          .nullable()
          .optional()
          .refine(
            (val) => {
              if (!val) return true;
              return mongoose.isValidObjectId(val);
            },
            { message: "Invalid assignee User ID" },
          ),
        dueDate: z
          .string()
          .nullable()
          .optional()
          .refine(
            (val) => {
              if (!val) return true;
              return !isNaN(Date.parse(val));
            },
            { message: "Invalid due date format" },
          ),
      }),
    )
    .min(1, "At least one item is required"),
});

const toggleItemSchema = z.object({
  itemIndex: z.number().int().min(0),
});

/**
 * Resolve a meeting from a client-supplied meeting id and enforce the
 * meeting's organization boundary before a checklist is read or changed.
 */
const resolveAuthorizedMeeting = async (req, action) => {
  const { meetingId } = req.params;

  if (!mongoose.isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const user = req.user;
  if (!user?._id && !user?.id) {
    throw new UnauthorizedError("Authentication required");
  }

  const userId = String(user._id || user.id);
  const meeting = await Meeting.findById(meetingId);

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  const organization = user.activeOrganization || user.organization;
  if (!isSameOrganization(meeting.organization, organization)) {
    throw new UnauthorizedError(
      "You don't have access to this meeting's organization",
    );
  }

  if (!hasPermission(user.role, "meetings", action)) {
    throw new UnauthorizedError(
      `You don't have permission to ${action} this meeting`,
    );
  }

  if (!canAccessMeetingDoc(meeting, { ...user, _id: user._id || user.id })) {
    throw new UnauthorizedError("You don't have access to this meeting");
  }

  return { meeting, userId };
};

const requireChecklistManager = (user, meeting) => {
  const userId = String(user._id || user.id);
  const isOwner = String(meeting.uploadedBy) === userId;
  const isAdminOrOwner = user.role === "admin" || user.role === "owner";

  if (!isOwner && !isAdminOrOwner) {
    throw new UnauthorizedError(
      "Only the meeting owner or an organization administrator can manage the checklist",
    );
  }
};

export const createChecklist = async (req, res, next) => {
  try {
    const { items } = createChecklistSchema.parse(req.body);
    const { meeting, userId } = await resolveAuthorizedMeeting(req, "create");

    requireChecklistManager(req.user, meeting);

    const existingChecklist = await MeetingChecklist.findOne({
      meetingId: meeting._id,
    });

    if (existingChecklist) {
      throw new ValidationError("Checklist already exists for this meeting");
    }

    const checklist = await MeetingChecklist.create({
      meetingId: meeting._id,
      organization: meeting.organization,
      createdBy: userId,
      items,
      completions: [],
    });

    const populatedChecklist = await checklist.populate(
      "items.assignee",
      "name email profilePic",
    );

    sendSuccess(
      res,
      { checklist: populatedChecklist },
      "Checklist created successfully",
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const getChecklist = async (req, res, next) => {
  try {
    const { meeting } = await resolveAuthorizedMeeting(req, "view");

    const checklist = await MeetingChecklist.findOne({
      meetingId: meeting._id,
      organization: meeting.organization,
    }).populate("items.assignee", "name email profilePic");

    if (!checklist) {
      return sendSuccess(res, { checklist: null }, "No checklist found");
    }

    sendSuccess(res, { checklist }, "Checklist retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const toggleItem = async (req, res, next) => {
  try {
    const { itemIndex } = toggleItemSchema.parse(req.body);
    const { meeting, userId } = await resolveAuthorizedMeeting(req, "edit");

    const checklist = await MeetingChecklist.findOne({
      meetingId: meeting._id,
      organization: meeting.organization,
    });

    if (!checklist) {
      throw new NotFoundError("Checklist not found");
    }

    if (itemIndex < 0 || itemIndex >= checklist.items.length) {
      throw new ValidationError("Invalid item index");
    }

    const completionIndex = checklist.completions.findIndex(
      (completion) =>
        completion.itemIndex === itemIndex &&
        completion.userId.toString() === userId,
    );

    const update =
      completionIndex > -1
        ? { $pull: { completions: { itemIndex, userId } } }
        : { $push: { completions: { itemIndex, userId } } };

    const updatedChecklist = await MeetingChecklist.findOneAndUpdate(
      {
        meetingId: meeting._id,
        organization: meeting.organization,
      },
      update,
      { new: true },
    ).populate("items.assignee", "name email profilePic");

    if (!updatedChecklist) {
      throw new NotFoundError("Checklist not found");
    }

    sendSuccess(
      res,
      { checklist: updatedChecklist },
      "Item toggled successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const updateChecklist = async (req, res, next) => {
  try {
    const { items } = createChecklistSchema.parse(req.body);
    const { meeting } = await resolveAuthorizedMeeting(req, "edit");

    requireChecklistManager(req.user, meeting);

    let checklist = await MeetingChecklist.findOne({
      meetingId: meeting._id,
      organization: meeting.organization,
    });

    if (!checklist) {
      throw new NotFoundError("Checklist not found");
    }

    checklist.items = items;
    // Remove completions of indices that are now out of bounds
    checklist.completions = checklist.completions.filter(
      (comp) => comp.itemIndex < items.length,
    );

    await checklist.save();

    const populatedChecklist = await checklist.populate(
      "items.assignee",
      "name email profilePic",
    );

    sendSuccess(
      res,
      { checklist: populatedChecklist },
      "Checklist updated successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const deleteChecklist = async (req, res, next) => {
  try {
    const { meeting } = await resolveAuthorizedMeeting(req, "delete");
    requireChecklistManager(req.user, meeting);

    const deletedChecklist = await MeetingChecklist.findOneAndDelete({
      meetingId: meeting._id,
      organization: meeting.organization,
    });

    if (!deletedChecklist) {
      throw new NotFoundError("Checklist not found");
    }

    sendSuccess(
      res,
      { checklist: deletedChecklist },
      "Checklist deleted successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const getReadiness = async (req, res, next) => {
  try {
    const { meeting } = await resolveAuthorizedMeeting(req, "view");

    const checklist = await MeetingChecklist.findOne({
      meetingId: meeting._id,
      organization: meeting.organization,
    });

    if (!checklist) {
      return sendSuccess(res, { readiness: [] }, "No checklist found");
    }

    const totalItems = checklist.items.length;
    const userCompletions = checklist.completions.reduce((acc, completion) => {
      const uid = completion.userId.toString();
      acc[uid] = (acc[uid] || 0) + 1;
      return acc;
    }, {});

    const readiness = meeting.participants.map((participant) => {
      const uid =
        participant.user?.toString() ||
        participant.userId?.toString() ||
        participant._id?.toString() ||
        participant.id?.toString();
      const completedCount = uid ? userCompletions[uid] || 0 : 0;

      return {
        userId:
          participant.user ||
          participant.userId ||
          participant._id ||
          participant.id,
        name: participant.name || participant.email || "Unknown",
        percentage:
          totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0,
        completedCount,
        totalItems,
      };
    });

    sendSuccess(res, { readiness }, "Readiness retrieved successfully");
  } catch (error) {
    next(error);
  }
};
