import { z } from "zod";
import mongoose from "mongoose";
import MeetingFeedback from "../models/meetingFeedbackModel.js";
import Meeting from "../models/meetingModel.js";

const feedbackSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  overallRating: z.number().min(1).max(5),
  summaryAccuracy: z.number().min(1).max(5),
  transcriptQuality: z.number().min(1).max(5),
  comment: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// @desc    Submit or update feedback for a meeting
// @route   POST /api/feedback
// @access  Private
export const submitFeedback = async (req, res, next) => {
  try {
    const validatedData = feedbackSchema.parse(req.body);
    const userId = req.user._id;

    // Verify meeting exists and user is a participant or organizer
    const meeting = await Meeting.findById(validatedData.meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    // Check if user is participant or the owner
    const isOwner = meeting.uploadedBy.toString() === userId.toString();
    const isParticipant = meeting.participants?.some(
      (p) => p.user?.toString() === userId.toString(),
    );

    if (!isOwner && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to submit feedback for this meeting",
      });
    }

    // Upsert feedback
    const feedbackData = {
      ...validatedData,
      userId,
      organization: meeting.organization || req.user.organization,
    };

    const feedback = await MeetingFeedback.findOneAndUpdate(
      { meetingId: validatedData.meetingId, userId },
      { $set: feedbackData },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const io = req.app.get("io");
    if (io) {
      io.to(validatedData.meetingId).emit("feedback:submitted", feedback);
    }

    res.status(200).json({ success: true, feedback });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(error);
    }
    console.error("Error submitting feedback:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Get all feedback for a specific meeting
// @route   GET /api/feedback/meeting/:meetingId
// @access  Private
export const getFeedbackForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID" });
    }

    // Authorize: only the meeting owner or a participant may read its feedback,
    // matching submitFeedback in this file. Without this, any authenticated user
    // could read another org's feedback and submitter PII (IDOR).
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const isOwner = meeting.uploadedBy.toString() === userId.toString();
    const isParticipant = meeting.participants?.some(
      (p) => p.user?.toString() === userId.toString(),
    );

    if (!isOwner && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view feedback for this meeting",
      });
    }

    const feedback = await MeetingFeedback.find({ meetingId }).populate(
      "userId",
      "name email profilePicture",
    );

    res.status(200).json({ success: true, feedback });
  } catch (error) {
    console.error("Error fetching meeting feedback:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Get aggregate feedback for an organization
// @route   GET /api/feedback/aggregate/:orgId
// @access  Private
export const getAggregateFeedback = async (req, res) => {
  try {
    const { orgId } = req.params;

    if (!mongoose.isValidObjectId(orgId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID" });
    }

    // Ensure the user belongs to the org
    if (req.user.organization?.toString() !== orgId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this organization's feedback",
      });
    }

    const aggregation = await MeetingFeedback.aggregate([
      { $match: { organization: new mongoose.Types.ObjectId(orgId) } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          avgOverall: { $avg: "$overallRating" },
          avgSummary: { $avg: "$summaryAccuracy" },
          avgTranscript: { $avg: "$transcriptQuality" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const formattedData = aggregation.map((item) => {
      const date = new Date(item._id.year, item._id.month - 1);
      return {
        month: date.toLocaleString("default", {
          month: "short",
          year: "numeric",
        }),
        overall: Number(item.avgOverall.toFixed(2)),
        summary: Number(item.avgSummary.toFixed(2)),
        transcript: Number(item.avgTranscript.toFixed(2)),
        count: item.count,
      };
    });

    res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Error aggregating feedback:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Delete a feedback entry
// @route   DELETE /api/feedback/:id
// @access  Private
export const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid feedback ID" });
    }

    const feedback = await MeetingFeedback.findById(id);

    if (!feedback) {
      return res
        .status(404)
        .json({ success: false, message: "Feedback not found" });
    }

    if (feedback.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this feedback",
      });
    }

    await feedback.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};
