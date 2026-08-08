import mongoose from "mongoose";
import Poll from "../models/pollModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";

/**
 * Strip voter identities from anonymous polls while preserving hasVoted flag
 * @param {Object} poll - Poll document
 * @param {string} currentUserId - Current user's ID
 * @returns {Object} Poll with voter info stripped if anonymous
 */
const stripVotersIfAnonymous = (poll, currentUserId = null) => {
  const pollObj = poll.toObject ? poll.toObject() : { ...poll };

  if (pollObj.isAnonymous) {
    // For anonymous polls, replace voter arrays with vote counts
    pollObj.options = pollObj.options.map((opt) => ({
      _id: opt._id,
      text: opt.text,
      voteCount: opt.votes ? opt.votes.length : 0,
      // Track if current user has voted without revealing identity
      hasVoted:
        currentUserId && opt.votes
          ? opt.votes.some((v) => {
              const voteId = typeof v === "string" ? v : v._id?.toString();
              return voteId === currentUserId.toString();
            })
          : false,
    }));
  }

  return pollObj;
};

/**
 * Helper to build the aggregation pipeline for casting votes
 */
const buildVotePipeline = (voterId, selectedObjectIds) => {
  return [
    {
      $set: {
        options: {
          $map: {
            input: "$options",
            as: "opt",
            in: {
              $cond: [
                { $in: ["$$opt._id", selectedObjectIds] },
                {
                  $mergeObjects: [
                    "$$opt",
                    {
                      votes: {
                        $setUnion: [
                          { $ifNull: ["$$opt.votes", []] },
                          [voterId],
                        ],
                      },
                    },
                  ],
                },
                "$$opt",
              ],
            },
          },
        },
      },
    },
  ];
};

/**
 * Helper to check if poll is open for voting
 */
const openPollFilter = (id, organization) => ({
  _id: String(id),
  organization: organization,
  isClosed: false,
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

/**
 * Helper to load poll for mutation operations
 */
const loadPollForMutation = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) {
    return { ok: false, status: 400, message: "Invalid poll ID" };
  }

  const poll = await Poll.findById(String(id));
  if (!poll) {
    return { ok: false, status: 404, message: "Poll not found" };
  }

  if (poll.organization.toString() !== user.organization.toString()) {
    return {
      ok: false,
      status: 403,
      message: "Forbidden: Not part of organization",
    };
  }

  return { ok: true, poll };
};

/**
 * Check if user can manage a poll (creator or admin/owner)
 */
const canManagePoll = (poll, user) => {
  const isCreator = poll.createdBy?.toString() === user.id?.toString();
  const isAdminOrOwner = user.role === "admin" || user.role === "owner";
  return isCreator || isAdminOrOwner;
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

    const pollResponse = stripVotersIfAnonymous(savedPoll, req.user.id);

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

    const currentUserId = req.user.id;
    const formattedPolls = polls.map((poll) =>
      stripVotersIfAnonymous(poll, currentUserId),
    );

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
    const { optionIds } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid poll ID" });
    }

    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Must provide at least one option to vote for" });
    }

    const callerOrg = req.user?.organization;
    const callerId = req.user?.id ?? req.user?._id;
    if (!callerOrg || !callerId) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const poll = await Poll.findById(String(id));
    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    if (poll.organization.toString() !== callerOrg.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    if (poll.isClosed) {
      return res.status(400).json({ message: "Poll is closed" });
    }

    if (poll.expiresAt && new Date(poll.expiresAt) <= new Date()) {
      await Poll.updateOne(
        { _id: String(id), isClosed: false },
        { $set: { isClosed: true } },
      );
      return res.status(400).json({ message: "Poll has expired" });
    }

    const requestedIds = [...new Set(optionIds.map((o) => String(o)))];

    if (poll.pollType === "single" && requestedIds.length > 1) {
      return res
        .status(400)
        .json({ message: "This poll only allows a single vote" });
    }

    const pollOptionIds = new Set(poll.options.map((o) => o._id.toString()));
    const selectedIds = requestedIds.filter((optionId) =>
      pollOptionIds.has(optionId),
    );

    if (
      selectedIds.length !== requestedIds.length ||
      selectedIds.length === 0
    ) {
      return res.status(400).json({ message: "Invalid option(s) provided" });
    }

    const voterId = new mongoose.Types.ObjectId(String(callerId));
    const selectedObjectIds = selectedIds.map(
      (optionId) => new mongoose.Types.ObjectId(optionId),
    );

    const updatedPoll = await Poll.findOneAndUpdate(
      openPollFilter(id, poll.organization),
      buildVotePipeline(voterId, selectedObjectIds),
      { new: true },
    );

    if (!updatedPoll) {
      return res.status(400).json({ message: "Poll is closed" });
    }

    await updatedPoll.populate("createdBy", "name email profilePicture");
    if (!updatedPoll.isAnonymous) {
      await updatedPoll.populate("options.votes", "name email profilePicture");
    }

    const pollResponse = stripVotersIfAnonymous(updatedPoll, callerId);

    const io = req.app.get("io");
    if (io) {
      io.to(updatedPoll.meeting.toString()).emit("poll:vote", pollResponse);
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

    const loaded = await loadPollForMutation(id, req.user);
    if (!loaded.ok) {
      return res.status(loaded.status).json({ message: loaded.message });
    }
    const { poll } = loaded;

    if (!canManagePoll(poll, req.user)) {
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

    const pollResponse = stripVotersIfAnonymous(closedPoll, req.user.id);

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

    const loaded = await loadPollForMutation(id, req.user);
    if (!loaded.ok) {
      return res.status(loaded.status).json({ message: loaded.message });
    }
    const { poll } = loaded;

    if (!canManagePoll(poll, req.user)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only creator or admin can delete poll" });
    }

    const meetingRoom = poll.meeting.toString();

    await Poll.deleteOne({ _id: String(id) });

    const io = req.app.get("io");
    if (io) {
      io.to(meetingRoom).emit("poll:deleted", { id });
    }

    res.status(200).json({ message: "Poll deleted successfully", id });
  } catch (error) {
    console.error("Error deleting poll:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
