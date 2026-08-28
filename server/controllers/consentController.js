/**
 * Consent Controller — Issue #2247
 *
 * Handles recording consent persistence and audit trail.
 * Responsibilities:
 *  1. Validate incoming consent records
 *  2. Persist consent to meeting document
 *  3. Log consent actions for audit trail
 *  4. Query consent status for meetings
 *
 * Follows the same pattern as meetingController.js —
 * all business logic delegated to service layer where possible.
 */

import { z } from "zod";
import Meeting from "../models/meetingModel.js";
import AuditService from "../services/AuditService.js";
import { sendSuccess } from "../utils/responseHandler.js";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/errors.js";

// ═══════════════════════════════════════════════════════════════
// Zod validation schemas
// ═══════════════════════════════════════════════════════════════

const CONSENT_VERSION = "1.0";

const recordConsentSchema = z.object({
  meetingId: z.string().optional(),
  context: z.enum(["record", "upload", "room"]),
  consentVersion: z.string().min(1),
  consentTimestamp: z.string().datetime(),
});

const participantConsentSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  userId: z.string().optional(),
  name: z.string().min(1, "Participant name is required"),
  email: z.string().email("Valid email is required"),
  context: z.enum(["record", "upload", "room"]).default("room"),
  granted: z.boolean(),
});

const revokeConsentSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  reason: z.string().max(500).optional(),
});

const checkConsentQuerySchema = z.object({
  meetingId: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

const getUserId = (req) => {
  const id = req.user?.id || req.user?._id;
  if (!id) throw new UnauthorizedError();
  return id.toString();
};

// ═══════════════════════════════════════════════════════════════
// Controller handlers
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/consent/record
 *
 * Records the uploader/organizer's explicit consent for a meeting.
 * If meetingId is provided, attaches consent to the meeting document.
 * If no meetingId, stores in localStorage only (server-side audit log only).
 */
export const recordConsent = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    let validated;
    try {
      validated = recordConsentSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    const { meetingId, context, consentVersion, consentTimestamp } = validated;

    if (meetingId) {
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        throw new NotFoundError("Meeting not found");
      }

      meeting.recordingConsent = {
        required: true,
        granted: true,
        timestamp: new Date(consentTimestamp),
        version: consentVersion,
        context,
        userId,
        method: "explicit_click",
        revokedAt: null,
        revokeReason: null,
      };

      await meeting.save();

      // Audit log
      await AuditService.logAction({
        actorId: userId,
        action: "RECORDING_CONSENT_GRANTED",
        entity: "Meeting",
        entityId: meeting._id,
        organizationId: meeting.organization,
        details: {
          context,
          consentVersion,
          consentTimestamp,
        },
      });

      return sendSuccess(
        res,
        { meetingId: meeting._id, consent: meeting.recordingConsent },
        "Recording consent recorded successfully",
      );
    }

    // No meetingId — just log the consent action for audit
    await AuditService.logAction({
      actorId: userId,
      action: "RECORDING_CONSENT_GRANTED",
      entity: "Consent",
      entityId: null,
      organizationId: req.user?.organization || null,
      details: {
        context,
        consentVersion,
        consentTimestamp,
        note: "Consent recorded without meeting context (pre-meeting)",
      },
    });

    return sendSuccess(
      res,
      { consentTimestamp, consentVersion, context },
      "Recording consent acknowledged",
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/consent/participant
 *
 * Records a participant's consent for a live room.
 * Used when participants join a room and consent to recording.
 */
export const recordParticipantConsent = async (req, res, next) => {
  try {
    let validated;
    try {
      validated = participantConsentSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    const { meetingId, userId, name, email, context, granted } = validated;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new NotFoundError("Meeting not found");
    }

    const existingIdx = meeting.participantConsents.findIndex(
      (pc) =>
        (pc.userId && pc.userId.toString() === (userId || "")) ||
        pc.email === email,
    );

    const consentRecord = {
      userId: userId || undefined,
      name,
      email,
      granted,
      timestamp: new Date(),
      version: CONSENT_VERSION,
      context: context || "room",
      method: "explicit_click",
      revokedAt: null,
    };

    if (existingIdx >= 0) {
      meeting.participantConsents[existingIdx] = consentRecord;
    } else {
      meeting.participantConsents.push(consentRecord);
    }

    await meeting.save();

    // Audit log
    await AuditService.logAction({
      actorId: userId || req.user?.id || req.user?._id || null,
      action: granted
        ? "PARTICIPANT_CONSENT_GRANTED"
        : "PARTICIPANT_CONSENT_DENIED",
      entity: "Meeting",
      entityId: meeting._id,
      organizationId: meeting.organization,
      details: {
        participantName: name,
        participantEmail: email,
        context,
        granted,
      },
    });

    return sendSuccess(
      res,
      { meetingId: meeting._id, consent: consentRecord },
      granted
        ? "Participant consent recorded"
        : "Participant consent denial recorded",
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/consent/revoke
 *
 * Revokes previously granted consent for a meeting.
 * Blocks further recording if org policy requires consent.
 */
export const revokeConsent = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    let validated;
    try {
      validated = revokeConsentSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    const { meetingId, reason } = validated;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new NotFoundError("Meeting not found");
    }

    meeting.recordingConsent.granted = false;
    meeting.recordingConsent.revokedAt = new Date();
    meeting.recordingConsent.revokeReason = reason || "User revoked consent";

    await meeting.save();

    await AuditService.logAction({
      actorId: userId,
      action: "RECORDING_CONSENT_REVOKED",
      entity: "Meeting",
      entityId: meeting._id,
      organizationId: meeting.organization,
      details: {
        reason: reason || "User revoked consent",
      },
    });

    return sendSuccess(
      res,
      { meetingId: meeting._id },
      "Recording consent revoked",
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/consent/check?meetingId=xxx
 *
 * Checks consent status for a meeting. Returns whether consent is required,
 * whether it has been granted, and participant consent status.
 */
export const checkConsent = async (req, res, next) => {
  try {
    let validated;
    try {
      validated = checkConsentQuerySchema.parse(req.query);
    } catch (zodErr) {
      return next(zodErr);
    }

    const meeting = await Meeting.findById(validated.meetingId).select(
      "recordingConsent participantConsents organization",
    );

    if (!meeting) {
      throw new NotFoundError("Meeting not found");
    }

    const consent = meeting.recordingConsent || {};
    const participantConsents = meeting.participantConsents || [];

    return sendSuccess(
      res,
      {
        meetingId: meeting._id,
        consentRequired: consent.required || false,
        consentGranted: consent.granted || false,
        consentTimestamp: consent.timestamp || null,
        consentVersion: consent.version || null,
        consentContext: consent.context || null,
        participantConsents: participantConsents.map((pc) => ({
          name: pc.name,
          email: pc.email,
          granted: pc.granted,
          timestamp: pc.timestamp,
          context: pc.context,
        })),
      },
      "Consent status retrieved",
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/consent/audit?meetingId=xxx
 *
 * Returns the full consent audit trail for a meeting.
 * Used for compliance reporting.
 */
export const getConsentAuditTrail = async (req, res, next) => {
  try {
    let validated;
    try {
      validated = checkConsentQuerySchema.parse(req.query);
    } catch (zodErr) {
      return next(zodErr);
    }

    const meeting = await Meeting.findById(validated.meetingId).select(
      "recordingConsent participantConsents organization title",
    );

    if (!meeting) {
      throw new NotFoundError("Meeting not found");
    }

    const consent = meeting.recordingConsent || {};
    const participantConsents = meeting.participantConsents || [];

    const auditTrail = {
      meetingId: meeting._id,
      meetingTitle: meeting.title,
      organizationId: meeting.organization,
      organizerConsent: {
        granted: consent.granted || false,
        timestamp: consent.timestamp || null,
        version: consent.version || null,
        context: consent.context || null,
        method: consent.method || null,
        revokedAt: consent.revokedAt || null,
        revokeReason: consent.revokeReason || null,
      },
      participantConsents: participantConsents.map((pc) => ({
        userId: pc.userId || null,
        name: pc.name,
        email: pc.email,
        granted: pc.granted,
        timestamp: pc.timestamp,
        version: pc.version,
        context: pc.context,
        method: pc.method,
        revokedAt: pc.revokedAt || null,
      })),
      totalParticipants: participantConsents.length,
      allConsented: participantConsents.every((pc) => pc.granted),
      revokedCount: participantConsents.filter((pc) => pc.revokedAt).length,
    };

    return sendSuccess(
      res,
      { auditTrail },
      "Consent audit trail retrieved",
    );
  } catch (err) {
    next(err);
  }
};
