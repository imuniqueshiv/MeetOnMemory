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
 */
const resolveTargetUserId = async (owner, organizationId, meetingOrganizer) => {
  if (!owner || owner === "Unassigned") {
    return meetingOrganizer ? meetingOrganizer.toString() : null;
  }

  if (mongoose.Types.ObjectId.isValid(owner)) {
    return owner.toString();
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

  for (const item of items) {
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
        // Issue #977: these were filed under "meetings", so the
        // `pushTaskAssignments` toggle governed nothing while
        // `pushMeetingReminders` silently killed task reminders — the switches
        // were wired to the wrong behaviour.
        "tasks",
        "/tasks",
        "View Action Items",
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
        "/tasks",
        "View Action Items",
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
  }

  return {
    processedCount,
    upcomingCount,
    overdueCount,
  };
};
