import Meeting from "../models/meetingModel.js";
import MeetingDigestService from "../services/MeetingDigestService.js";
import { sendSuccess } from "../utils/responseHandler.js";

/**
 * Controller to handle manual resend of the meeting digest.
 */
export const resendDigest = async (req, res, next) => {
  try {
    const { id: meetingId } = req.params;

    // Using requireOwnerOrAdmin ensures req.doc is populated
    // We can also double check it exists
    if (!req.doc) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const result = await MeetingDigestService.sendMeetingDigest(meetingId);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return sendSuccess(
      res,
      { recipientsSentTo: result.recipientsSentTo },
      result.message,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to handle fetching the HTML preview of the meeting digest.
 */
export const previewDigest = async (req, res, next) => {
  try {
    const { id: meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const html = MeetingDigestService.buildDigestHtml(meeting);

    return res.status(200).send(html);
  } catch (err) {
    next(err);
  }
};
