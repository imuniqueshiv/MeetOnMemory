// server/controllers/workspaceController.js
import Meeting from "../models/meetingModel.js";
import mongoose from "mongoose";

/**
 * @desc Get initial War Room state (Canvas + Action Board)
 * @route GET /api/workspace/:meetingId/state
 * @access Private (Participants only)
 */
export const getWorkspaceState = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Meeting ID" });
    }

    const meeting = await Meeting.findById(meetingId).select(
      "warRoom participants uploadedBy title",
    );

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    // Authorization check
    const isParticipant = meeting.participants.some(
      (p) =>
        p.user?.toString() === req.user._id.toString() ||
        p.email === req.user.email,
    );
    const isOwner = meeting.uploadedBy?.toString() === req.user._id.toString();

    if (!isParticipant && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Not a meeting participant",
      });
    }

    // Default structure if warRoom doesn't exist yet
    const warRoom = meeting.warRoom || {
      canvasNodes: [],
      canvasPaths: [],
      actionColumns: {
        backlog: [],
        "in-progress": [],
        blocked: [],
        done: [],
      },
    };

    res.status(200).json({
      success: true,
      meetingTitle: meeting.title,
      warRoom,
      participants: meeting.participants,
    });
  } catch (error) {
    console.error("Error fetching workspace state:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching workspace state",
    });
  }
};

/**
 * @desc Add a new action item to the backlog via REST (fallback if socket fails)
 * @route POST /api/workspace/:meetingId/action
 * @access Private
 */
export const addActionItem = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { title, assignee, priority } = req.body;

    if (!title || title.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Action title is required" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting)
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });

    if (!meeting.warRoom) meeting.warRoom = { actionColumns: {} };
    if (!meeting.warRoom.actionColumns) meeting.warRoom.actionColumns = {};
    if (!meeting.warRoom.actionColumns.backlog)
      meeting.warRoom.actionColumns.backlog = [];

    const newItem = {
      _id: new mongoose.Types.ObjectId(),
      title: title.trim(),
      assignee,
      priority: priority || "medium",
      createdAt: new Date(),
    };

    meeting.warRoom.actionColumns.backlog.push(newItem);
    meeting.markModified("warRoom.actionColumns");
    await meeting.save();

    res.status(201).json({
      success: true,
      message: "Action item added to backlog",
      item: newItem,
    });
  } catch (error) {
    console.error("Error adding action item:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error adding action item" });
  }
};
