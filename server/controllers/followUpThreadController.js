import followUpThreadModel from "../models/followUpThreadModel.js";
import threadReplyModel from "../models/threadReplyModel.js";
import notificationModel from "../models/notificationModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";

// Keep only the mentioned user IDs that belong to the same organization, so a
// client-supplied mentions array can't spam notifications to arbitrary users.
async function filterOrgMembers(mentions, organizationId) {
  if (!Array.isArray(mentions) || mentions.length === 0 || !organizationId) {
    return [];
  }
  const members = await User.find({
    _id: { $in: mentions },
    organization: organizationId,
  }).select("_id");
  return members.map((m) => m._id);
}

// Resolve a thread to its meeting and confirm the caller shares its org.
// Returns { thread, meeting } on success or { error: { status, message } }.
async function resolveThreadOrgAccess(threadId, user) {
  const thread = await followUpThreadModel.findById(threadId);
  if (!thread) {
    return { error: { status: 404, message: "Thread not found" } };
  }
  const meeting = await Meeting.findById(thread.meetingId);
  if (!meeting) {
    return { error: { status: 404, message: "Meeting not found" } };
  }
  const isOwner = meeting.uploadedBy?.toString() === user._id.toString();
  const isInSameOrg =
    meeting.organization &&
    user.organization &&
    meeting.organization.toString() === user.organization.toString();
  if (!isOwner && !isInSameOrg) {
    return {
      error: { status: 403, message: "You don't have access to this thread" },
    };
  }
  return { thread, meeting };
}

export const createThread = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { anchorType, anchorIndex, anchorText, content, mentions } = req.body;
    const createdBy = req.user._id;

    const thread = await followUpThreadModel.create({
      meetingId,
      anchorType,
      anchorIndex,
      anchorText,
      createdBy,
    });

    // Only notify mentioned users who are members of the caller's org.
    const validMentions = await filterOrgMembers(
      mentions,
      req.user.organization,
    );

    const reply = await threadReplyModel.create({
      threadId: thread._id,
      author: createdBy,
      content,
      mentions: validMentions,
    });

    const populatedReply = await threadReplyModel
      .findById(reply._id)
      .populate("author", "name avatar");

    // Notifications for mentions
    if (validMentions.length > 0) {
      const notifications = validMentions.map((userId) => ({
        user: userId,
        title: "You were mentioned in a thread",
        description: `${populatedReply.author.name} mentioned you in a follow-up thread.`,
        category: "meetings",
        actionUrl: `/meeting/${meetingId}?threadId=${thread._id}`,
        actionLabel: "View Thread",
      }));
      await notificationModel.insertMany(notifications);
    }

    const io = req.app.get("io");
    if (io) {
      io.to(meetingId).emit("thread:created", {
        thread,
        reply: populatedReply,
      });
    }

    res.status(201).json({ success: true, thread, reply: populatedReply });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getThreadsByMeetingId = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const threads = await followUpThreadModel
      .find({ meetingId })
      .populate("createdBy", "name avatar")
      .sort({ createdAt: 1 });

    // get replies
    const threadIds = threads.map((t) => t._id);
    const replies = await threadReplyModel
      .find({ threadId: { $in: threadIds } })
      .populate("author", "name avatar")
      .populate("mentions", "name avatar")
      .sort({ createdAt: 1 });

    const threadsWithReplies = threads.map((t) => {
      const tObj = t.toObject();
      tObj.replies = replies.filter(
        (r) => r.threadId.toString() === t._id.toString(),
      );
      return tObj;
    });

    res.status(200).json({ success: true, threads: threadsWithReplies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createReply = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content, mentions } = req.body;
    const author = req.user._id;

    const access = await resolveThreadOrgAccess(threadId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }
    // Derive the meeting from the thread instead of trusting req.body.meetingId.
    const meetingId = access.thread.meetingId.toString();

    // Only notify mentioned users who are members of the caller's org.
    const validMentions = await filterOrgMembers(
      mentions,
      req.user.organization,
    );

    const reply = await threadReplyModel.create({
      threadId,
      author,
      content,
      mentions: validMentions,
    });

    const populatedReply = await threadReplyModel
      .findById(reply._id)
      .populate("author", "name avatar")
      .populate("mentions", "name avatar");

    // Notifications for mentions
    if (validMentions.length > 0) {
      const notifications = validMentions.map((userId) => ({
        user: userId,
        title: "You were mentioned in a reply",
        description: `${populatedReply.author.name} mentioned you in a follow-up thread reply.`,
        category: "meetings",
        actionUrl: `/meeting/${meetingId}?threadId=${threadId}`,
        actionLabel: "View Reply",
      }));
      await notificationModel.insertMany(notifications);
    }

    const io = req.app.get("io");
    if (io) {
      io.to(meetingId).emit("thread:reply", { reply: populatedReply });
    }

    res.status(201).json({ success: true, reply: populatedReply });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const { content } = req.body;
    const authorId = req.user._id;

    const reply = await threadReplyModel.findById(replyId);
    if (!reply) {
      return res
        .status(404)
        .json({ success: false, message: "Reply not found" });
    }

    if (reply.author.toString() !== authorId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to edit this reply" });
    }

    // Check 15-minute window
    const now = new Date();
    const diffMs = now - reply.createdAt;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins > 15) {
      return res.status(403).json({
        success: false,
        message: "Edit window has expired (15 minutes)",
      });
    }

    reply.content = content;
    reply.edited = true;
    await reply.save();

    const populatedReply = await threadReplyModel
      .findById(reply._id)
      .populate("author", "name avatar")
      .populate("mentions", "name avatar");

    res.status(200).json({ success: true, reply: populatedReply });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const authorId = req.user._id;

    const reply = await threadReplyModel.findById(replyId);
    if (!reply) {
      return res
        .status(404)
        .json({ success: false, message: "Reply not found" });
    }

    if (reply.author.toString() !== authorId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to delete this reply" });
    }

    const now = new Date();
    const diffMs = now - reply.createdAt;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins > 15) {
      return res.status(403).json({
        success: false,
        message: "Delete window has expired (15 minutes)",
      });
    }

    await threadReplyModel.findByIdAndDelete(replyId);

    res.status(200).json({ success: true, message: "Reply deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveThread = async (req, res) => {
  try {
    const { threadId } = req.params;
    const resolvedBy = req.user._id;

    const access = await resolveThreadOrgAccess(threadId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }
    const thread = access.thread;

    thread.status = "resolved";
    thread.resolvedBy = resolvedBy;
    await thread.save();

    const populatedThread = await followUpThreadModel
      .findById(threadId)
      .populate("resolvedBy", "name avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(thread.meetingId.toString()).emit("thread:resolved", {
        thread: populatedThread,
      });
    }

    res.status(200).json({ success: true, thread: populatedThread });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
