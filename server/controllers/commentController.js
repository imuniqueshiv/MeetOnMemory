import Comment, { MAX_COMMENT_LENGTH } from "../models/commentModel.js";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import mongoose from "mongoose";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";

/**
 * Ceiling on replies loaded alongside one page of top-level comments
 * (Issue #1071).
 */
const MAX_REPLIES_PER_PAGE = 500;

/**
 * Create a notification for the meeting owner when a new comment is added
 *
 * @param {Object} comment - The newly created comment
 * @param {Object} meeting - The meeting object
 * @param {Object} author - The comment author
 * @returns {Promise<void>}
 */
const createCommentNotification = async (comment, meeting, author) => {
  try {
    // Safely extract IDs (handles both Mongoose Objects, strings, and undefined test mocks)
    const authorId =
      comment.author?._id?.toString() ||
      comment.author?.toString?.() ||
      (comment.author ? String(comment.author) : null);
    const ownerId =
      meeting.uploadedBy?._id?.toString() ||
      meeting.uploadedBy?.toString?.() ||
      (meeting.uploadedBy ? String(meeting.uploadedBy) : null);

    // Don't notify the comment author about their own comment
    if (authorId && ownerId && authorId === ownerId) {
      console.log("Skipping self-notification for comment author");
      return;
    }

    // Check if meeting has an owner
    if (!meeting.uploadedBy) {
      console.log("Meeting has no owner, skipping notification");
      return;
    }

    // Check for duplicate notifications (prevent spam)
    // Look for existing notification for this comment in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingNotification = await Notification.findOne({
      user: meeting.uploadedBy,
      category: "meetings",
      "metadata.commentId": comment._id,
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (existingNotification) {
      console.log("Duplicate notification prevented for comment:", comment._id);
      return;
    }

    // Determine if this is a reply or top-level comment
    const isReply = !!comment.parentComment;

    // Create notification title and description
    const title = isReply
      ? `${author.name || "Someone"} replied to a comment`
      : `${author.name || "Someone"} commented on your meeting`;

    const description = isReply
      ? `New reply in "${meeting.title}": "${comment.body.substring(0, 100)}${comment.body.length > 100 ? "..." : ""}"`
      : `New comment on "${meeting.title}": "${comment.body.substring(0, 100)}${comment.body.length > 100 ? "..." : ""}"`;

    // Create the notification
    const notification = new Notification({
      user: meeting.uploadedBy,
      title: title,
      description: description,
      category: "meetings",
      isRead: false,
      actionUrl: `/meetings/${meeting._id}#comment-${comment._id}`,
      actionLabel: "View Comment",
      metadata: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        commentId: comment._id,
        commentAuthorId: comment.author,
        commentAuthorName: author.name,
        isReply: isReply,
        parentCommentId: comment.parentComment || null,
      },
    });

    await notification.save();

    console.log(
      `✅ Notification created for meeting owner: ${meeting.uploadedBy}`,
    );

    // Emit real-time notification via Socket.IO
    const io = comment.$locals?.io; // Passed via locals if available
    if (io) {
      io.to(meeting.uploadedBy.toString()).emit("notification:new", {
        id: notification._id,
        title: notification.title,
        description: notification.description,
        category: notification.category,
        isRead: notification.isRead,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt,
      });
    }
  } catch (error) {
    // Don't fail the comment creation if notification fails
    console.error("Error creating comment notification:", error);
  }
};

// @desc Create a new comment
// @route POST /api/comments
// @access Private (Org Members)
export const createComment = async (req, res) => {
  try {
    const { meetingId, body, parentComment } = req.body;

    // Validate meeting ID format
    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    // Validate parent comment ID if provided
    if (parentComment && !mongoose.isValidObjectId(parentComment)) {
      return res.status(400).json({ message: "Invalid parent comment ID" });
    }

    // Validate comment body is provided and not empty
    if (!body || typeof body !== "string" || !body.trim()) {
      return res.status(400).json({ message: "Comment body is required" });
    }

    // Validate comment length
    if (body.trim().length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        message: `Comment content exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`,
      });
    }

    // RBAC Check: User must have permission to view meetings
    if (!req.user.role || !hasPermission(req.user.role, "meetings", "view")) {
      return res
        .status(403)
        .json({ message: "Forbidden: Insufficient permissions" });
    }

    // Fetch meeting and validate it exists
    const meeting = await Meeting.findById(String(meetingId));
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Verify user belongs to the same organization as the meeting
    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    // If this is a reply, validate the parent comment exists
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
      if (parent.meeting.toString() !== meetingId) {
        return res
          .status(400)
          .json({ message: "Parent comment does not belong to this meeting" });
      }
    }

    // Create the comment
    const comment = new Comment({
      meeting: meetingId,
      author: req.user.id,
      organization: req.user.organization,
      body: body.trim(),
      parentComment: parentComment || null,
    });

    const savedComment = await comment.save();
    await savedComment.populate("author", "name email profilePicture");

    const savedCommentObj = savedComment.toObject();
    savedCommentObj.reactions = [];

    // Emit Socket.IO event for real-time updates to all meeting participants
    const io = req.app.get("io");
    if (io) {
      io.to(meetingId).emit("comment:new", savedCommentObj);

      // Store io reference for notification function
      savedComment.$locals = { io };
    }

    // Create notification for meeting owner
    await createCommentNotification(savedComment, meeting, req.user);

    res.status(201).json(savedCommentObj);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
  }
};

// @desc Get comments for a meeting (paginated, nested)
// @route GET /api/comments/meeting/:meetingId
// @access Private
export const getCommentsByMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    // Validate meeting ID format
    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    // Parse pagination parameters with defaults
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 50,
    });

    // Fetch meeting and validate it exists
    const meeting = await Meeting.findById(String(meetingId));
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Verify user belongs to the same organization
    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    // Fetch top-level comments (no parent)
    const topLevelComments = await Comment.find({
      meeting: String(meetingId),
      parentComment: null,
    })
      .populate("author", "name email profilePicture")
      .populate("reactions.user", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Fetch replies for these comments
    const commentIds = topLevelComments.map((c) => c._id);

    const replies = commentIds.length
      ? await Comment.find({ parentComment: { $in: commentIds } })
          .populate("author", "name email profilePicture")
          .populate("reactions.user", "name")
          .sort({ createdAt: 1 })
          .limit(MAX_REPLIES_PER_PAGE)
      : [];

    // Group replies by parent comment ID
    const repliesMap = {};
    replies.forEach((reply) => {
      const parentId = reply.parentComment.toString();
      if (!repliesMap[parentId]) repliesMap[parentId] = [];
      const replyObj = reply.toObject();
      if (replyObj.reactions) {
        replyObj.reactions = replyObj.reactions.filter(
          (r) => r && r.emoji && r.user,
        );
      }
      repliesMap[parentId].push(replyObj);
    });

    // Attach replies to their parent comments
    const commentsWithReplies = topLevelComments.map((c) => {
      const doc = c.toObject();
      if (doc.reactions) {
        doc.reactions = doc.reactions.filter((r) => r && r.emoji && r.user);
      }
      doc.replies = repliesMap[doc._id.toString()] || [];
      return doc;
    });

    // Get total count for pagination metadata
    const total = await Comment.countDocuments({
      meeting: String(meetingId),
      parentComment: null,
    });

    const pagination = buildPaginationMeta({ total, page, limit });

    res.status(200).json({
      comments: commentsWithReplies,
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      totalComments: pagination.total,
      pagination,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
  }
};

// @desc Update a comment
// @route PATCH /api/comments/:id
// @access Private (Author only)
export const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    // Validate comment ID format
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    // Validate comment body is provided
    if (!body || typeof body !== "string" || !body.trim()) {
      return res.status(400).json({ message: "Comment body is required" });
    }

    // Validate comment length
    if (body.trim().length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        message: `Comment content exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`,
      });
    }

    // Fetch comment and validate it exists
    const comment = await Comment.findById(String(id));
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Verify user is the comment author
    if (comment.author.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only author can edit" });
    }

    // Update comment body and mark as edited
    comment.body = body.trim();
    comment.isEdited = true;

    const updatedComment = await comment.save();
    await updatedComment.populate("author", "name email profilePicture");

    const updatedCommentObj = updatedComment.toObject();
    if (updatedCommentObj.reactions) {
      updatedCommentObj.reactions = updatedCommentObj.reactions.filter(
        (r) => r && r.emoji && r.user,
      );
    }

    // Emit Socket.IO event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.to(comment.meeting.toString()).emit(
        "comment:update",
        updatedCommentObj,
      );
    }

    res.status(200).json(updatedCommentObj);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
  }
};

// @desc Delete a comment
// @route DELETE /api/comments/:id
// @access Private (Author or Admin)
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate comment ID format
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    // Fetch comment and validate it exists
    const comment = await Comment.findById(String(id));
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if user is author or admin/owner
    const isAuthor = comment.author.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin" || req.user.role === "owner";

    if (!isAuthor && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only author or admin can delete" });
    }

    // Delete the comment
    await Comment.deleteOne({ _id: String(id) });

    // Cascade delete child replies
    await Comment.deleteMany({ parentComment: String(id) });

    // Emit Socket.IO event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.to(comment.meeting.toString()).emit("comment:delete", {
        id,
        parentComment: comment.parentComment,
      });
    }

    res.status(200).json({ message: "Comment deleted successfully", id });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
  }
};

// @desc Toggle a reaction on a comment
// @route POST /api/comments/:id/reactions
// @access Private
export const toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Validate emoji parameter
    if (!emoji || typeof emoji !== "string" || !emoji.trim()) {
      return res.status(400).json({ message: "Reaction emoji is required" });
    }

    // Validate comment ID format
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    // Fetch comment and validate it exists
    const comment = await Comment.findById(String(id));
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Defensive check and cleanup for reactions array
    if (!comment.reactions) {
      comment.reactions = [];
    }

    // Clean invalid reactions from the document array before checking
    comment.reactions = comment.reactions.filter((r) => r && r.emoji && r.user);

    // Check if reaction already exists
    const existingReactionIndex = comment.reactions.findIndex(
      (r) =>
        r &&
        r.emoji === emoji &&
        r.user &&
        r.user.toString() === userId.toString(),
    );

    if (existingReactionIndex !== -1) {
      // Remove existing reaction
      comment.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add new reaction
      comment.reactions.push({ emoji, user: userId });
    }

    const updatedComment = await comment.save();
    await updatedComment.populate("reactions.user", "name");
    await updatedComment.populate("author", "name email profilePicture");

    // Clean up reactions array after populate in case any user was deleted
    const updatedCommentObj = updatedComment.toObject();
    if (updatedCommentObj.reactions) {
      updatedCommentObj.reactions = updatedCommentObj.reactions.filter(
        (r) => r && r.emoji && r.user,
      );
    }

    // Emit Socket.IO event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.to(comment.meeting.toString()).emit(
        "comment:reaction",
        updatedCommentObj,
      );
    }

    res.status(200).json(updatedCommentObj);
  } catch (error) {
    console.error("Error toggling reaction:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
  }
};
