import Poll from "../models/pollModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import mongoose from "mongoose";

/**
 * Loads a poll for a mutating request and runs the shared guards in the one
 * order that works (Issue #1069).
 *
 * `deletePoll` dereferenced `poll` one statement above `const poll = await
 * Poll.findById(...)`. Reading a `const` inside its temporal dead zone throws
 * `ReferenceError: Cannot access 'poll' before initialization`, the catch block
 * turned that into a generic 500, and so *every* `DELETE /api/polls/:id` failed
 * — for the creator, for admins, for polls that did not exist. `closePoll`
 * received the same organization guard in the same commit and got the ordering
 * right, which is exactly why this is worth centralising rather than fixing in
 * place: the guards can no longer be reordered independently per handler.
 *
 * @returns {{ok: true, poll: object} | {ok: false, status: number, message: string}}
 */
const loadPollForMutation = async (pollId, user) => {
  if (!mongoose.isValidObjectId(pollId)) {
    return { ok: false, status: 400, message: "Invalid poll ID" };
  }

  const poll = await Poll.findById(String(pollId));
  if (!poll) {
    return { ok: false, status: 404, message: "Poll not found" };
  }

  // A session with no organization used to blow up on `.toString()` of
  // undefined and surface as a 500. It is a 403: the caller is not in the
  // poll's organization, because they are not in one at all.
  const callerOrg = user?.organization;
  if (!callerOrg || poll.organization.toString() !== callerOrg.toString()) {
    return {
      ok: false,
      status: 403,
      message: "Forbidden: Not part of organization",
    };
  }

  return { ok: true, poll };
};

/** Creator-or-admin check shared by close and delete. */
const canManagePoll = (poll, user) => {
  const callerId = user?.id ?? user?._id;
  const isCreator =
    Boolean(callerId) && poll.createdBy.toString() === callerId.toString();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  return isCreator || isAdmin;
};

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

/**
 * Matches a poll that is currently open — closed flag down, expiry in the
 * future or absent (Issue #1072).
 *
 * Used as the *filter* of the vote update rather than as a preceding `if`, so
 * a poll that closes between the read and the write rejects the vote instead
 * of silently accepting it.
 */
const openPollFilter = (pollId, organizationId, now = new Date()) => ({
  _id: String(pollId),
  organization: organizationId,
  isClosed: false,
  $or: [
    { expiresAt: null },
    { expiresAt: { $exists: false } },
    { expiresAt: { $gt: now } },
  ],
});

/**
 * The vote itself, expressed as an aggregation-pipeline update so MongoDB
 * applies "clear my previous votes, then record my new ones" server-side
 * against current state (Issue #1072).
 *
 * The handler used to load the poll, rebuild `options[].votes` in memory and
 * `save()` the whole array back. Because the filter step reassigns the array,
 * Mongoose emits a `$set` of the entire array as it looked at *read* time —
 * no `$push`, no version guard, no unique index — so two people voting in the
 * same event-loop window overwrote each other:
 *
 *     t0  Alice reads  votes: []
 *     t1  Bob   reads  votes: []
 *     t2  Alice writes votes: [alice]
 *     t3  Bob   writes votes: [bob]        <- Alice's vote is gone
 *
 * Both callers got a 200 and both clients rendered their own vote as
 * recorded, so the loss was invisible until someone read the tally. In a live
 * meeting where a room votes on a countdown, that is most of the votes.
 *
 * A pipeline update runs under the document lock, so concurrent votes
 * serialize and each one sees its predecessor's result. The `$filter` before
 * the append is what makes it idempotent: a retry can never leave the same
 * voter in an option twice.
 */
const buildVotePipeline = (voterId, selectedOptionIds) => [
  {
    $set: {
      options: {
        $map: {
          input: "$options",
          as: "opt",
          in: {
            $mergeObjects: [
              "$$opt",
              {
                votes: {
                  $let: {
                    vars: {
                      // Everyone except this voter, in their original order.
                      others: {
                        $filter: {
                          input: "$$opt.votes",
                          as: "v",
                          cond: { $ne: ["$$v", voterId] },
                        },
                      },
                    },
                    in: {
                      $cond: [
                        { $in: ["$$opt._id", selectedOptionIds] },
                        { $concatArrays: ["$$others", [voterId]] },
                        "$$others",
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
  },
];

// @desc    Cast a vote
// @route   POST /api/polls/:id/vote
// @access  Private
export const castVote = async (req, res) => {
  try {
    const { id } = req.params;
    const { optionIds } = req.body; // Array of option IDs

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
      // Guarded so a vote landing in the same instant cannot be clobbered by
      // this bookkeeping write.
      await Poll.updateOne(
        { _id: String(id), isClosed: false },
        { $set: { isClosed: true } },
      );
      return res.status(400).json({ message: "Poll has expired" });
    }

    // Deduplicate before the arity check: `{ optionIds: [x, x, x] }` used to
    // push the same voter into one option three times, so `voteCount` counted
    // one person as three.
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

    // Every id must belong to this poll. Previously unknown ids were silently
    // dropped and the vote still counted as long as one id happened to match.
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
      // The filter no longer matches — the poll closed or expired between the
      // validation read and the write. Reject rather than resurrect it.
      return res.status(400).json({ message: "Poll is closed" });
    }

    await updatedPoll.populate("createdBy", "name email profilePicture");
    if (!updatedPoll.isAnonymous) {
      await updatedPoll.populate("options.votes", "name email profilePicture");
    }

    const pollResponse = stripVotersIfAnonymous(updatedPoll);

    const io = req.app.get("io");
    if (io) {
      // Broadcast the committed document, so every client converges on the
      // same tally instead of on whichever snapshot its own request happened
      // to build.
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

    // Read the room off the document before it goes away — after `deleteOne`
    // there is nothing left to read `meeting` from.
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
