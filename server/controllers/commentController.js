import Comment from "../models/commentModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import mongoose from "mongoose";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";

/**
 * Ceiling on replies loaded alongside one page of top-level comments
 * (Issue #1071).
 *
 * The reply query is a `$in` over every comment id on the page and had no
 * limit of its own, so an unbounded `?limit=` did not just return N comments —
 * it also pulled every reply belonging to all N and populated author and
 * reaction refs across the whole set. Bounding the page bounds the fan-out,
 * but only if the second query is bounded independently: a page of 50 comments
 * where one thread has 10,000 replies is still one enormous response
 * otherwise.
 */
const MAX_REPLIES_PER_PAGE = 500;

// @desc    Create a new comment
// @route   POST /api/comments
// @access  Private (Org Members)
export const createComment = async (req, res) => {
  try {
    const { meetingId, body, parentComment } = req.body;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }
    if (parentComment && !mongoose.isValidObjectId(parentComment)) {
      return res.status(400).json({ message: "Invalid parent comment ID" });
    }

    // RBAC Check
    if (!req.user.role || !hasPermission(req.user.role, "meetings", "view")) {
      return res
        .status(403)
        .json({ message: "Forbidden: Insufficient permissions" });
    }

    const meeting = await Meeting.findById(String(meetingId));
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const comment = new Comment({
      meeting: meetingId,
      author: req.user.id,
      organization: req.user.organization,
      body,
      parentComment: parentComment || null,
    });

    const savedComment = await comment.save();
    await savedComment.populate("author", "name email profilePicture");

    // Emit Socket.IO event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.to(meetingId).emit("comment:new", savedComment);
    }

    // Trigger notification to the meeting owner (placeholder for notification logic)
    // Here we can integrate with Notification model or logic if it exists

    res.status(201).json(savedComment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Get comments for a meeting (paginated, nested)
// @route   GET /api/comments/meeting/:meetingId
// @access  Private
export const getCommentsByMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 50,
    });

    const meeting = await Meeting.findById(String(meetingId));
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    // Fetch top-level comments
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

    // Group replies
    const repliesMap = {};
    replies.forEach((reply) => {
      const parentId = reply.parentComment.toString();
      if (!repliesMap[parentId]) repliesMap[parentId] = [];
      repliesMap[parentId].push(reply);
    });

    // Attach replies
    const commentsWithReplies = topLevelComments.map((c) => {
      const doc = c.toObject();
      doc.replies = repliesMap[doc._id.toString()] || [];
      return doc;
    });

    const total = await Comment.countDocuments({
      meeting: String(meetingId),
      parentComment: null,
    });

    const pagination = buildPaginationMeta({ total, page, limit });

    res.status(200).json({
      comments: commentsWithReplies,
      // `currentPage` / `totalPages` / `totalComments` are kept so existing
      // clients keep working; `pagination` is the shape new code should read,
      // and it is the only one carrying `hasMore`.
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      totalComments: pagination.total,
      pagination,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Update a comment
// @route   PATCH /api/comments/:id
// @access  Private (Author only)
export const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await Comment.findById(String(id));
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.author.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only author can edit" });
    }

    comment.body = body;
    comment.isEdited = true;
    const updatedComment = await comment.save();
    await updatedComment.populate("author", "name email profilePicture");

    const io = req.app.get("io");
    if (io) {
      io.to(comment.meeting.toString()).emit("comment:update", updatedComment);
    }

    res.status(200).json(updatedComment);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private (Author or Admin)
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await Comment.findById(String(id));
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isAuthor = comment.author.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin" || req.user.role === "owner";

    if (!isAuthor && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only author or admin can delete" });
    }

    // Delete comment
    await Comment.deleteOne({ _id: String(id) });

    // Cascade delete child replies
    await Comment.deleteMany({ parentComment: String(id) });

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
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Toggle a reaction on a comment
// @route   POST /api/comments/:id/reactions
// @access  Private
export const toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await Comment.findById(String(id));
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const existingReactionIndex = comment.reactions.findIndex(
      (r) => r.emoji === emoji && r.user.toString() === userId.toString(),
    );

    if (existingReactionIndex !== -1) {
      // Remove reaction
      comment.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add reaction
      comment.reactions.push({ emoji, user: userId });
    }

    const updatedComment = await comment.save();
    await updatedComment.populate("reactions.user", "name");
    await updatedComment.populate("author", "name email profilePicture");

    const io = req.app.get("io");
    if (io) {
      io.to(comment.meeting.toString()).emit(
        "comment:reaction",
        updatedComment,
      );
    }

    res.status(200).json(updatedComment);
  } catch (error) {
    console.error("Error toggling reaction:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
