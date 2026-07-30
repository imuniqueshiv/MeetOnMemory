import Poll from "../models/pollModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import mongoose from "mongoose";

// Helper function to strip voter IDs if poll is anonymous
const stripVotersIfAnonymous = (poll) => {
  if (poll.isAnonymous) {
    const pollObj = poll.toObject ? poll.toObject() : poll;
    pollObj.options = pollObj.options.map((option) => ({
      ...option,
      voteCount: option.votes.length,
      votes: [], // Hide who voted
    }));
    return pollObj;
  }
  return poll;
};

// @desc    Create a new poll
// @route   POST /api/polls
// @access  Private (Organizer/Admin)
export const createPoll = async (req, res) => {
  try {
    const { meetingId, question, options, pollType, isAnonymous, expiresAt } =
      req.body;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    if (!options || options.length < 2) {
      return res
        .status(400)
        .json({ message: "A poll must have at least two options." });
    }

    // RBAC Check (assume organizer/admin or owner)
    // Actually, maybe any member with view/edit access can create a poll, let's enforce based on meeting access.
    if (!req.user.role || !hasPermission(req.user.role, "meetings", "edit")) {
      return res.status(403).json({
        message: "Forbidden: Insufficient permissions to create poll",
      });
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

    const formattedOptions = options.map((opt) => ({ text: opt, votes: [] }));

    const poll = new Poll({
      meeting: meetingId,
      organization: req.user.organization,
      createdBy: req.user.id,
      question,
      options: formattedOptions,
      pollType: pollType || "single",
      isAnonymous: isAnonymous || false,
      expiresAt: expiresAt || null,
    });

    const savedPoll = await poll.save();
    await savedPoll.populate("createdBy", "name email profilePicture");

    const pollResponse = stripVotersIfAnonymous(savedPoll);

    const io = req.app.get("io");
    if (io) {
      io.to(meetingId.toString()).emit("poll:created", pollResponse);
    }

    res.status(201).json(pollResponse);
  } catch (error) {
    console.error("Error creating poll:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Get all polls for a meeting
// @route   GET /api/polls/meeting/:meetingId
// @access  Private
export const getPollsByMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

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

    const polls = await Poll.find({ meeting: String(meetingId) })
      .populate("createdBy", "name email profilePicture")
      .populate("options.votes", "name email profilePicture")
      .sort({ createdAt: -1 });

    const formattedPolls = polls.map(stripVotersIfAnonymous);

    res.status(200).json(formattedPolls);
  } catch (error) {
    console.error("Error fetching polls:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Cast a vote
// @route   POST /api/polls/:id/vote
// @access  Private
export const castVote = async (req, res) => {
  try {
    const { id } = req.params;
    const { optionIds } = req.body; // Array of option IDs
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid poll ID" });
    }

    const poll = await Poll.findById(String(id));
    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    if (poll.isClosed) {
      return res.status(400).json({ message: "Poll is closed" });
    }

    if (poll.expiresAt && new Date(poll.expiresAt) <= new Date()) {
      poll.isClosed = true;
      await poll.save();
      return res.status(400).json({ message: "Poll has expired" });
    }

    if (poll.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Must provide at least one option to vote for" });
    }

    if (poll.pollType === "single" && optionIds.length > 1) {
      return res
        .status(400)
        .json({ message: "This poll only allows a single vote" });
    }

    // Remove user's previous votes for this poll
    poll.options.forEach((option) => {
      option.votes = option.votes.filter(
        (v) => v.toString() !== userId.toString(),
      );
    });

    // Add new votes
    let validVotesCast = 0;
    poll.options.forEach((option) => {
      if (optionIds.includes(option._id.toString())) {
        option.votes.push(userId);
        validVotesCast++;
      }
    });

    if (validVotesCast === 0) {
      return res.status(400).json({ message: "Invalid option(s) provided" });
    }

    const savedPoll = await poll.save();
    await savedPoll.populate("createdBy", "name email profilePicture");
    if (!poll.isAnonymous) {
      await savedPoll.populate("options.votes", "name email profilePicture");
    }

    const pollResponse = stripVotersIfAnonymous(savedPoll);

    const io = req.app.get("io");
    if (io) {
      io.to(poll.meeting.toString()).emit("poll:vote", pollResponse);
    }

    res.status(200).json(pollResponse);
  } catch (error) {
    console.error("Error casting vote:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Close a poll
// @route   PATCH /api/polls/:id/close
// @access  Private (Creator/Admin)
export const closePoll = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid poll ID" });
    }

    const poll = await Poll.findById(String(id));
    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const isCreator = poll.createdBy.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin" || req.user.role === "owner";

    if (!isCreator && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only creator or admin can close poll" });
    }

    poll.isClosed = true;
    const closedPoll = await poll.save();
    await closedPoll.populate("createdBy", "name email profilePicture");
    if (!poll.isAnonymous) {
      await closedPoll.populate("options.votes", "name email profilePicture");
    }

    const pollResponse = stripVotersIfAnonymous(closedPoll);

    const io = req.app.get("io");
    if (io) {
      io.to(poll.meeting.toString()).emit("poll:closed", pollResponse);
    }

    res.status(200).json(pollResponse);
  } catch (error) {
    console.error("Error closing poll:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Delete a poll
// @route   DELETE /api/polls/:id
// @access  Private (Creator/Admin)
export const deletePoll = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid poll ID" });
    }

    const poll = await Poll.findById(String(id));
    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const isCreator = poll.createdBy.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin" || req.user.role === "owner";

    if (!isCreator && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only creator or admin can delete poll" });
    }

    await Poll.deleteOne({ _id: String(id) });

    const io = req.app.get("io");
    if (io) {
      io.to(poll.meeting.toString()).emit("poll:deleted", { id });
    }

    res.status(200).json({ message: "Poll deleted successfully", id });
  } catch (error) {
    console.error("Error deleting poll:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
