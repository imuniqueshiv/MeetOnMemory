import {
  getPersonalNudges,
  updateNudgeStatus,
  getMeetingReadiness,
  previewMeetingNudges,
  triggerMeetingNudges,
} from "../services/meetingNudgeService.js";
import Meeting from "../models/meetingModel.js";

export const getMyNudges = async (req, res) => {
  try {
    const nudges = await getPersonalNudges(
      req.user._id,
      req.query.organization,
    );
    res.json(nudges);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch nudges", error: err.message });
  }
};

export const updateNudge = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["PENDING", "SENT", "DISMISSED", "ACTED_ON"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const updated = await updateNudgeStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ message: "Nudge not found" });
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update nudge", error: err.message });
  }
};

export const getReadiness = async (req, res) => {
  try {
    const readiness = await getMeetingReadiness(req.params.meetingId);
    res.json(readiness || { averageScore: 100, participants: [] });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch readiness", error: err.message });
  }
};

/**
 * Preview upcoming nudges for organizers (Issue #2062)
 */
export const getMeetingNudgesPreview = async (req, res) => {
  try {
    const preview = await previewMeetingNudges(req.params.meetingId);
    res.json({ success: true, ...preview });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to preview nudges", error: err.message });
  }
};

/**
 * Trigger manual test dispatch of nudges (Issue #2062)
 */
export const triggerMeetingNudgesManual = async (req, res) => {
  try {
    const result = await triggerMeetingNudges(
      req.params.meetingId,
      req.user._id,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to trigger nudges", error: err.message });
  }
};

/**
 * Update meeting nudge automation settings (Issue #2062)
 */
export const updateMeetingNudgeSettings = async (req, res) => {
  try {
    const { enabled } = req.body;
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.meetingId,
      { nudgesEnabled: Boolean(enabled) },
      { new: true },
    );
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    res.json({
      success: true,
      nudgesEnabled: meeting.nudgesEnabled,
      message: `Nudge automation ${meeting.nudgesEnabled ? "enabled" : "disabled"} for this meeting.`,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update nudge settings", error: err.message });
  }
};
