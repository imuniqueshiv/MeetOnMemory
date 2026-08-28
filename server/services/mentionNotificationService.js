import mongoose from "mongoose";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";

/**
 * Escapes HTML characters in comment/note text to sanitize stored markup and prevent XSS.
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizeMarkup(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Parses mentions from text and sends real-time and persistent notifications to mentioned members.
 *
 * @param {Object} options
 * @param {string} options.text - Raw comment body or note text containing mentions
 * @param {Object|string} options.author - Comment author object or ID
 * @param {string} options.organizationId - Organization ID
 * @param {Object} [options.meeting] - Optional Meeting object or ID
 * @param {string} [options.commentId] - Optional comment ID
 * @param {Object} [options.actionItem] - Optional action item object or ID
 * @returns {Promise<Array<string>>} List of notified user IDs
 */
export async function processMentionNotifications({
  text,
  author,
  organizationId,
  meeting,
  commentId,
  actionItem,
}) {
  if (!text || typeof text !== "string") return [];

  try {
    const authorId =
      author?._id?.toString() ||
      author?.id?.toString() ||
      (author ? String(author) : null);
    const authorName = author?.name || "A team member";

    // Matches `@[User Name](userId)` or `@username`
    const mentionRegex =
      /@\[([^\]]+)\]\(([^)]+)\)|@([a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)?)/g;
    const userIdsToNotify = new Set();
    const usernamesToSearch = new Set();

    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[2] && mongoose.isValidObjectId(match[2])) {
        userIdsToNotify.add(match[2]);
      } else if (match[3]) {
        usernamesToSearch.add(match[3].trim());
      }
    }

    if (usernamesToSearch.size > 0 && organizationId) {
      const nameRegexes = Array.from(usernamesToSearch).map(
        (name) =>
          new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      );

      const matchedUsers = await User.find({
        organization: organizationId,
        $or: [{ name: { $in: nameRegexes } }, { email: { $in: nameRegexes } }],
      }).select("_id");

      matchedUsers.forEach((u) => userIdsToNotify.add(u._id.toString()));
    }

    const notifiedUserIds = [];

    for (const targetUserId of userIdsToNotify) {
      // Don't notify the author themselves
      if (targetUserId === authorId) continue;

      const meetingId = meeting?._id || meeting;
      const meetingTitle = meeting?.title || "Meeting";

      const title = meeting
        ? `${authorName} mentioned you in a comment`
        : `${authorName} mentioned you in an action item`;

      const description =
        text.length > 120 ? `${text.substring(0, 120)}...` : text;

      const actionUrl = meetingId
        ? `/meetings/${meetingId}#comment-${commentId || ""}`
        : actionItem
          ? `/action-items`
          : "/meetings";

      const notification = new Notification({
        user: targetUserId,
        title,
        description,
        category: meetingId ? "meetings" : "tasks",
        isRead: false,
        actionUrl,
        actionLabel: "View Mention",
        metadata: {
          mentionedBy: authorId,
          meetingId: meetingId || null,
          meetingTitle,
          commentId: commentId || null,
          actionItemId: actionItem?._id || actionItem || null,
        },
      });

      await notification.save();
      notifiedUserIds.push(targetUserId);
    }

    return notifiedUserIds;
  } catch (error) {
    console.error("Error processing mention notifications:", error);
    return [];
  }
}
