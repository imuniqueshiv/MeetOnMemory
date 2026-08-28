import ActionItem from "../models/actionItemModel.js";
import userModel from "../models/userModel.js";
import { createNotification } from "./notificationService.js";
import mongoose from "mongoose";
import { CASE_INSENSITIVE_COLLATION } from "../utils/regexUtils.js";

/**
 * Resolves target user ID for an action item owner.
 *
 * `owner` is free text — the model extracts it from a transcript and nothing
 * validates it on the way in. It used to be interpolated straight into
 * `new RegExp(`^${owner.trim()}$`, "i")` (Issue #1157), which made this the
 * most exposed of the seven sites: it runs inside a `node-cron` sweep every
 * fifteen minutes, in-process, once per open action item with a due date. An
 * owner string of `(a+)+$` backtracks exponentially against every user name in
 * the organization and stalls the event loop on a schedule. The `try/catch`
 * below does not help, because a hang is not an exception.
 *
 * The lookup wants case-insensitive *equality* on the name, so it is now an
 * equality query with a collation: same semantics, no compilation step, and it
 * can use an index on `name`.
 *
 * Recipients are always resolved within the action item's organization so
 * reminders cannot cross tenant boundaries (#1397).
 */
const resolveTargetUserId = async (owner, organizationId, meetingOrganizer) => {
  if (!owner || owner === "Unassigned") {
    return meetingOrganizer ? meetingOrganizer.toString() : null;
  }

  if (mongoose.Types.ObjectId.isValid(owner)) {
    try {
      const query = { _id: owner };
      if (organizationId) {
        query.organization = organizationId;
      }
      const user = await userModel.findOne(query).select("_id");
      if (user) return user._id.toString();
    } catch (err) {
      console.error(
        "Error resolving ObjectId owner for action item reminder:",
        err,
      );
    }
    return meetingOrganizer ? meetingOrganizer.toString() : null;
  }

  // Try finding user by email or name within the organization
  try {
    const trimmedOwner = String(owner).trim();
    if (!trimmedOwner) {
      return meetingOrganizer ? meetingOrganizer.toString() : null;
    }

    const user = await userModel
      .findOne({
        organization: organizationId,
        $or: [{ email: trimmedOwner.toLowerCase() }, { name: trimmedOwner }],
      })
      .collation(CASE_INSENSITIVE_COLLATION)
      .select("_id");

    if (user) return user._id.toString();
  } catch (err) {
    console.error("Error resolving target user for action item reminder:", err);
  }

  return meetingOrganizer ? meetingOrganizer.toString() : null;
};

/**
 * Processes automated reminders for upcoming and overdue action items.
 *
 * Eligibility (existing model semantics — do not invent statuses):
 * - status in open | in-progress (excludes resolved / superseded)
 * - dueDate present
 * - remindersEnabled not false
 * - lifecycleState not archived | expired
 * - not merged away (supersededByMemory unset)
 *
 * Duplicate prevention reuses `reminderSent.upcoming` / `reminderSent.overdue`.
 *
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} [options.organization] - Optional org filter
 * @returns {Promise<Object>} Summary of processed reminders
 */
export const processActionItemReminders = async ({ organization } = {}) => {
  const now = new Date();
  const upcomingWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24 hours

  const filter = {
    status: { $in: ["open", "in-progress"] },
    dueDate: { $ne: null },
    remindersEnabled: { $ne: false },
    // Archived / expired memories must not generate reminders (#1397).
    lifecycleState: { $nin: ["archived", "expired"] },
    // Merged-away duplicates are kept for history but are not actionable.
    supersededByMemory: null,
  };

  if (organization) {
    filter.organization = organization;
  }

  const items = await ActionItem.find(filter).populate(
    "sourceMeetingId",
    "title organizer organization",
  );

  let upcomingCount = 0;
  let overdueCount = 0;
  let processedCount = 0;
  let errorCount = 0;

  for (const item of items) {
    try {
      if (!item.dueDate) continue;

      const dueDate = new Date(item.dueDate);
      const orgId = item.organization || item.sourceMeetingId?.organization;
      const meetingOrganizer = item.sourceMeetingId?.organizer;

      const targetUserId = await resolveTargetUserId(
        item.owner,
        orgId,
        meetingOrganizer,
      );
      if (!targetUserId) continue;

      let updated = false;

      // Check for Upcoming Reminder (due within 24 hours)
      if (
        dueDate > now &&
        dueDate <= upcomingWindow &&
        !item.reminderSent?.upcoming
      ) {
        const meetingTitle = item.sourceMeetingId?.title
          ? ` (${item.sourceMeetingId.title})`
          : "";
        await createNotification(
          targetUserId,
          `⏰ Action Item Due Soon`,
          `Your action item "${item.text}"${meetingTitle} is due on ${dueDate.toLocaleDateString()}.`,
          "tasks",
          `/followup/tasks/${item._id}`,
          "View Task",
          { actionItemId: item._id, reminderType: "upcoming", dueDate },
        );

        if (!item.reminderSent) {
          item.reminderSent = { upcoming: false, overdue: false };
        }
        item.reminderSent.upcoming = true;
        item.reminderSent.upcomingSentAt = now;
        updated = true;
        upcomingCount++;
      }

      // Check for Overdue Reminder (due in the past)
      if (dueDate < now && !item.reminderSent?.overdue) {
        const meetingTitle = item.sourceMeetingId?.title
          ? ` (${item.sourceMeetingId.title})`
          : "";
        await createNotification(
          targetUserId,
          `⚠️ Action Item Overdue`,
          `Your action item "${item.text}"${meetingTitle} was due on ${dueDate.toLocaleDateString()}.`,
          "tasks",
          `/followup/tasks/${item._id}`,
          "View Task",
          { actionItemId: item._id, reminderType: "overdue", dueDate },
        );

        if (!item.reminderSent) {
          item.reminderSent = { upcoming: false, overdue: false };
        }
        item.reminderSent.overdue = true;
        item.reminderSent.overdueSentAt = now;
        updated = true;
        overdueCount++;
      }

      if (updated) {
        await item.save();
        processedCount++;
      }
    } catch (err) {
      // One item failure must not abort the rest of the sweep (#1397).
      errorCount++;
      console.error(
        `Error processing action item reminder for ${item?._id}:`,
        err,
      );
    }
  }

  return {
    processedCount,
    upcomingCount,
    overdueCount,
    errorCount,
  };
};
