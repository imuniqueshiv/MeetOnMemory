import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import { createNotification } from "../services/notificationService.js";

/**
 * Request to shadow a meeting
 */
export const requestToShadow = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (!meeting.allowObservers) {
      return res
        .status(403)
        .json({ message: "This meeting does not allow observers." });
    }

    // Check if user is already a participant
    const isParticipant = meeting.participants.some(
      (p) => p.user && p.user.toString() === userId.toString(),
    );
    if (isParticipant) {
      return res
        .status(400)
        .json({ message: "You are already a participant." });
    }

    if (!meeting.pendingObservers) meeting.pendingObservers = [];
    if (meeting.pendingObservers.includes(userId)) {
      return res
        .status(400)
        .json({ message: "Shadow request already pending." });
    }
    meeting.pendingObservers.push(userId);
    await meeting.save();

    const user = await User.findById(userId);

    // Send notification to the meeting owner/organizer
    if (meeting.uploadedBy) {
      await createNotification({
        recipient: meeting.uploadedBy,
        sender: userId,
        type: "shadow_request",
        title: "Shadow Request",
        message: `${user.name} has requested to shadow your meeting: ${meeting.title}`,
        metadata: {
          meetingId: meeting._id,
          userId: userId,
        },
      });
    }

    res.status(200).json({ message: "Shadow request sent successfully." });
  } catch (error) {
    console.error("Error in requestToShadow:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Approve shadow request
 */
export const approveShadowRequest = async (req, res) => {
  try {
    const { meetingId, userId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Ensure only owner/organizer can approve
    if (meeting.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Not authorized to approve shadow requests for this meeting",
      });
    }

    // Check if already a participant
    const isParticipant = meeting.participants.some(
      (p) => p.user && p.user.toString() === userId.toString(),
    );
    if (isParticipant) {
      return res
        .status(400)
        .json({ message: "User is already a participant." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    meeting.pendingObservers = meeting.pendingObservers.filter(
      (id) => id.toString() !== userId.toString(),
    );
    meeting.participants.push({
      user: user._id,
      name: user.name,
      email: user.email,
      role: "observer",
    });

    await meeting.save();

    // Notify the user that they have been approved
    await createNotification({
      recipient: userId,
      sender: req.user._id,
      type: "shadow_approved",
      title: "Shadow Request Approved",
      message: `Your request to shadow the meeting "${meeting.title}" has been approved.`,
      metadata: {
        meetingId: meeting._id,
      },
    });

    res.status(200).json({ message: "Shadow request approved.", meeting });
  } catch (error) {
    console.error("Error in approveShadowRequest:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Deny shadow request
 */
export const denyShadowRequest = async (req, res) => {
  try {
    const { meetingId, userId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    meeting.pendingObservers = meeting.pendingObservers.filter(
      (id) => id.toString() !== userId.toString(),
    );
    await meeting.save();

    // Notify the user that they have been denied
    await createNotification({
      recipient: userId,
      sender: req.user._id,
      type: "shadow_denied",
      title: "Shadow Request Denied",
      message: `Your request to shadow the meeting "${meeting.title}" has been denied.`,
      metadata: {
        meetingId: meeting._id,
      },
    });

    res.status(200).json({ message: "Shadow request denied." });
  } catch (error) {
    console.error("Error in denyShadowRequest:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get pending shadow requests
 */
export const getPendingShadowRequests = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findById(meetingId).populate(
      "pendingObservers",
      "name email avatar",
    );
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    if (meeting.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    res.status(200).json({ pendingObservers: meeting.pendingObservers });
  } catch (error) {
    console.error("Error in getPendingShadowRequests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
