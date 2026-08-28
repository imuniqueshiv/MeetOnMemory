/**
 * Recording Consent Middleware — Issue #2247
 *
 * Middleware that enforces recording consent before allowing media capture.
 * Used on upload, transcript, and recording endpoints.
 *
 * Behavior:
 *  - If org policy requires consent, checks that consent is granted on the meeting
 *  - If meeting has no consent requirement, allows the request through
 *  - Returns 403 with descriptive message if consent is missing
 */

import Meeting from "../models/meetingModel.js";
import { ForbiddenError } from "../utils/errors.js";

/**
 * requireRecordingConsent — middleware factory
 *
 * @param {Object} options
 * @param {string} options.context — "record" | "upload" | "room"
 * @param {boolean} options.required — whether consent is mandatory (default: true)
 * @returns {Function} Express middleware
 */
export const requireRecordingConsent = ({
  context = "record",
  required = true,
} = {}) => {
  return async (req, res, next) => {
    try {
      // If consent not required, pass through
      if (!required) {
        return next();
      }

      // Extract meeting ID from various possible locations
      const meetingId =
        req.params.meetingId ||
        req.params.id ||
        req.body?.meetingId ||
        req.query?.meetingId;

      // If no meeting ID, this is a pre-meeting flow (e.g., standalone recorder)
      // Client-side consent modal handles this; server allows through
      if (!meetingId) {
        return next();
      }

      const meeting = await Meeting.findById(meetingId).select(
        "recordingConsent organization",
      );

      // If meeting not found, let the downstream handler deal with the error
      if (!meeting) {
        return next();
      }

      const consent = meeting.recordingConsent;

      // If consent is not required (default state), allow through
      if (!consent || !consent.required) {
        return next();
      }

      // If consent was granted, allow through
      if (consent.granted) {
        // Check if consent was revoked
        if (consent.revokedAt) {
          return res.status(403).json({
            success: false,
            message:
              "Recording consent has been revoked. Please obtain consent again before proceeding.",
            code: "CONSENT_REVOKED",
            consentStatus: {
              required: true,
              granted: false,
              revokedAt: consent.revokedAt,
              revokeReason: consent.revokeReason,
            },
          });
        }
        return next();
      }

      // Consent required but not granted — block the request
      return res.status(403).json({
        success: false,
        message:
          "Recording consent is required before proceeding. Please provide explicit consent in the consent dialog.",
        code: "CONSENT_REQUIRED",
        consentStatus: {
          required: true,
          granted: false,
          context,
        },
      });
    } catch (err) {
      next(err);
    }
  };
};

/**
 * checkParticipantConsent — middleware for live room endpoints
 *
 * Checks if a specific participant has granted consent for the meeting.
 */
export const checkParticipantConsent = async (req, res, next) => {
  try {
    const meetingId = req.params.meetingId || req.params.id;

    if (!meetingId) {
      return next();
    }

    const meeting = await Meeting.findById(meetingId).select(
      "recordingConsent participantConsents",
    );

    if (!meeting) {
      return next();
    }

    const consent = meeting.recordingConsent;

    // If consent not required, pass through
    if (!consent || !consent.required) {
      return next();
    }

    // Check participant-specific consent
    const userEmail = req.user?.email || req.user?.primaryEmailAddress?.emailAddress;
    const userId = req.user?.id || req.user?._id;

    if (userEmail || userId) {
      const participantConsent = meeting.participantConsents.find(
        (pc) =>
          (pc.email && pc.email === userEmail) ||
          (pc.userId && userId && pc.userId.toString() === userId.toString()),
      );

      if (participantConsent && participantConsent.granted && !participantConsent.revokedAt) {
        return next();
      }
    }

    // If organizer has granted consent, allow participants through
    // (organizer consent covers the session unless individual consent is enforced)
    if (consent.granted && !consent.revokedAt) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message:
        "Recording consent is required to participate in this meeting. Please provide your consent.",
      code: "PARTICIPANT_CONSENT_REQUIRED",
    });
  } catch (err) {
    next(err);
  }
};

export default requireRecordingConsent;
