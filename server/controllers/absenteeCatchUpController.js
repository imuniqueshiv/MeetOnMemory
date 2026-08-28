import AbsenteeCatchUpService from "../services/absenteeCatchUpService.js";

/**
 * Get all pending catch-ups for the authenticated user.
 */
export const getMyCatchUps = async (req, res) => {
  try {
    const userId = req.user.id;
    const catchUps = await AbsenteeCatchUpService.getPendingCatchUps(userId);
    res.status(200).json({ success: true, catchUps });
  } catch (error) {
    console.error("Error fetching catch-ups:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch catch-ups" });
  }
};

/**
 * Mark a catch-up digest as read.
 */
export const markCatchUpAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await AbsenteeCatchUpService.markAsRead(id);
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Catch-up not found" });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error marking catch-up read:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark catch-up read" });
  }
};

/**
 * Manually deliver a catch-up (can be used by organizer or system).
 */
export const deliverCatchUp = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await AbsenteeCatchUpService.deliverCatchUp(id);
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Catch-up not found" });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error delivering catch-up:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to deliver catch-up" });
  }
};

import AbsenteeCatchUp from "../models/absenteeCatchUpModel.js";
import Meeting from "../models/meetingModel.js";
import { generateAbsenteeCatchUpAI } from "../services/GenerativeAIService.js";

/**
 * Fetch catch-up briefing specifically for a meeting and current user.
 */
export const getMeetingCatchUp = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { meetingId } = req.params;

    const catchUp = await AbsenteeCatchUp.findOne({
      meetingId,
      userId,
    }).populate("meetingId", "title date summary");

    return res.status(200).json({ success: true, catchUp: catchUp || null });
  } catch (error) {
    console.error("Error fetching meeting catch-up:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch meeting catch-up" });
  }
};

/**
 * Generate on-demand catch-up briefing for the authenticated user for a meeting.
 */
export const generateMeetingCatchUp = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = req.user;
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const userName =
      `${user.firstName || user.name || "Participant"} ${user.lastName || ""}`.trim();
    const meetingSummary = {
      title: meeting.title,
      date: meeting.date,
      summary:
        meeting.summary ||
        meeting.structuredMoM?.summary ||
        "No summary available.",
    };

    const decisions = meeting.structuredMoM?.decisions || [];
    const actionItems = meeting.structuredMoM?.action_items || [];
    const mentions = [];

    const aiResult = await generateAbsenteeCatchUpAI(
      meeting.title,
      userName,
      meetingSummary,
      actionItems,
      decisions,
      mentions,
    );

    const catchUp = await AbsenteeCatchUp.findOneAndUpdate(
      { meetingId, userId },
      {
        meetingId,
        userId,
        content: aiResult,
        status: "pending",
      },
      { upsert: true, new: true },
    ).populate("meetingId", "title date summary");

    return res.status(200).json({ success: true, catchUp });
  } catch (error) {
    console.error("Error generating meeting catch-up:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to generate meeting catch-up" });
  }
};
