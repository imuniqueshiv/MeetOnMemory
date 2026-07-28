/**
 * Meeting Controller — HTTP layer only.
 *
 * Responsibilities:
 *  1. Parse and validate the incoming HTTP request (using Zod schemas).
 *  2. Delegate all business logic to MeetingService.
 *  3. Shape and send the HTTP response.
 *  4. Forward any error to the global error handler via next(err).
 *
 * This file intentionally contains NO database queries, NO AI calls, and
 * NO direct references to external APIs.  All of that lives in
 * server/services/MeetingService.js.
 */

import fs from "fs";
import path from "path";
import { z } from "zod";
import Meeting from "../models/meetingModel.js"; // eslint-disable-line no-unused-vars
import * as MeetingService from "../services/MeetingService.js";
import { ValidationError, UnauthorizedError } from "../utils/errors.js";
import AuditService from "../services/AuditService.js";
import { sendSuccess } from "../utils/responseHandler.js";
import * as activityService from "../services/activityService.js";
import MeetingDigestService from "../services/MeetingDigestService.js";

const pushMeetingToIntegrations = (...args) =>
  import("../services/calendarSyncService.js").then((mod) =>
    mod.pushMeetingToIntegrations(...args),
  );
// ═══════════════════════════════════════════════════════════════
// Zod validation schemas
// ═══════════════════════════════════════════════════════════════

const createMeetingSchema = z.object({
  title: z.string().min(1, "Meeting title is required"),
  description: z.string().optional().default(""),
  meetingType: z
    .enum(["conference", "policy", "event", "internal", "external", "board"])
    .optional()
    .default("conference"),
  date: z.string().optional(),
  time: z.string().optional().default(""),
  duration: z.number().nullable().optional(),
  location: z.string().optional().default(""),
  venue: z.string().optional().default(""),
  participants: z.array(z.record(z.unknown())).optional().default([]),
  agendaItems: z.array(z.record(z.unknown())).optional().default([]),
  policyDetails: z.record(z.unknown()).nullable().optional(),
  recordingType: z.enum(["upload", "live"]).optional().default("upload"),
});

const uploadMeetingSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  meetingType: z
    .enum(["conference", "policy", "event", "internal", "external", "board"])
    .optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return [val];
    }),
});

const summarizeMeetingSchema = z.object({
  meetingId: z.string().optional(),
  transcript: z.string().optional(),
  date: z.string({ required_error: "Meeting date is required." }),
  title: z.string().optional(),
});

const updateMeetingSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  meetingType: z
    .enum(["conference", "policy", "event", "internal", "external", "board"])
    .optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  duration: z.number().nullable().optional(),
  location: z.string().optional(),
  venue: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const searchMeetingSchema = z.object({
  query: z.string().optional(),
  audioUrl: z.string().url().optional(),
});

const notifyLiveMeetingSchema = z.object({
  roomId: z.string().min(1, "roomId is required"),
  participants: z
    .array(z.object({ name: z.string(), email: z.string().optional() }))
    .min(1, "At least one participant is required"),
});

const getAllMeetingsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 1;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 10;
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) return 10;
      return parsed > 100 ? 100 : parsed; // Cap at 100
    }),
  search: z.string().optional(),
  meetingType: z.string().optional(),
  includeArchived: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Helper to prevent path traversal in manual file cleanup checks
const validatePath = (filePath) => {
  if (!filePath) throw new Error("Path is required");
  const resolved = path.resolve(filePath);
  const uploadsDir = path.resolve("uploads");
  if (!resolved.startsWith(uploadsDir)) {
    throw new Error("Directory traversal detected: Access denied");
  }
  return resolved;
};

// ── Helper: extract userId from the request ───────────────────
const getUserId = (req) => {
  const id = req.user?.id || req.user?._id;
  if (!id) throw new UnauthorizedError();
  return id.toString();
};

// ═══════════════════════════════════════════════════════════════
// Controller handlers
// ═══════════════════════════════════════════════════════════════

/* ─────────────────────────────────────────────────────────────
   1. CREATE MEETING (Schedule from CreateMeeting form)
   Used by: CreateMeeting.jsx "Schedule Meeting" section
   ───────────────────────────────────────────────────────────── */
export const createMeeting = async (req, res, next) => {
  try {
    const uploaderId = getUserId(req);

    let validated;
    try {
      validated = createMeetingSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr); // ZodError → errorHandler → 400
    }

    const meeting = await MeetingService.createMeeting(
      uploaderId,
      req.user?.organization || null,
      validated,
    );

    if (req.body.syncToCalendar) {
      pushMeetingToIntegrations(uploaderId, meeting).catch(console.error);
    }

    if (req.user?.organization) {
      const io = req.app.get("io");
      activityService.logActivity(
        io,
        req.user.organization,
        uploaderId,
        "meeting.created",
        "Meeting",
        meeting._id,
        meeting.title,
      );
    }

    return sendSuccess(
      res,
      {
        meeting: {
          _id: meeting._id,
          title: meeting.title,
          meetingType: meeting.meetingType,
          date: meeting.date,
        },
      },
      "Meeting scheduled successfully",
    );
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   2. UPLOAD MEETING (Original - from UploadMeeting page)
   Used by: UploadMeeting.jsx
   ───────────────────────────────────────────────────────────── */
export const uploadMeeting = async (req, res, next) => {
  const uploadedFilePath = req.file?.path || null;

  try {
    if (!req.file) {
      throw new ValidationError("No audio file uploaded.");
    }
    const uploaderId = getUserId(req);

    let validated;
    try {
      validated = uploadMeetingSchema.parse(req.body);
    } catch (zodErr) {
      // Clean up the uploaded file on validation failure before routing
      if (uploadedFilePath) {
        try {
          const safePath = validatePath(uploadedFilePath);
          if (fs.existsSync(safePath)) {
            fs.unlinkSync(safePath);
          }
        } catch {
          // ignore cleanup errors
        }
      }
      throw zodErr;
    }

    const { meeting, transcript } =
      await MeetingService.uploadAndTranscribeMeeting(
        uploaderId,
        req.user?.organization || null,
        req.file,
        validated,
      );

    if (req.user?.organization) {
      const io = req.app.get("io");
      activityService.logActivity(
        io,
        req.user.organization,
        uploaderId,
        "meeting.uploaded",
        "Meeting",
        meeting._id,
        meeting.title,
      );
    }

    return sendSuccess(
      res,
      {
        meetingId: meeting._id,
        transcript,
      },
      "Meeting transcribed successfully",
    );
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   3. UPLOAD AUDIO FOR EXISTING MEETING
   Used by: CreateMeeting.jsx "Upload Meeting" section
   ───────────────────────────────────────────────────────────── */
export const uploadAudioForMeeting = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError("No audio file uploaded.");
    }
    const uploaderId = getUserId(req);
    const { meetingId } = req.body;

    if (!meetingId) {
      throw new ValidationError("Meeting ID is required");
    }

    const { meeting, transcript } =
      await MeetingService.uploadAudioForExistingMeeting(
        uploaderId,
        meetingId,
        req.file,
      );

    return sendSuccess(
      res,
      {
        meetingId: meeting._id,
        transcript,
      },
      "Audio uploaded and transcribed successfully",
    );
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   4. SUMMARIZE MEETING (Generate AI MOM)
   Used by: UploadMeeting.jsx and CreateMeeting.jsx
   ───────────────────────────────────────────────────────────── */
export const summarizeMeeting = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    let validated;
    try {
      validated = summarizeMeetingSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    const result = await MeetingService.generateMeetingMoM(
      userId,
      validated.meetingId || null,
      validated.transcript || "",
      validated.date,
      validated.title || null,
    );

    if (result.queued) {
      return sendSuccess(
        res,
        null,
        "Minutes generation started in the background. Please wait...",
        202,
      );
    }

    // Fire and forget email digest
    if (result.meetingId) {
      MeetingDigestService.sendMeetingDigest(result.meetingId).catch((err) => {
        console.error("Failed to send meeting digest automatically:", err);
      });
    }

    return sendSuccess(
      res,
      {
        mom: result.mom,
        momText: result.momText,
        meetingId: result.meetingId,
      },
      "Minutes generated successfully",
    );
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   5. GET ALL MEETINGS (Dashboard)
   Used by: Dashboard / Summaries page
   ───────────────────────────────────────────────────────────── */
export const getAllMeetings = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    let validatedQuery;
    try {
      validatedQuery = getAllMeetingsQuerySchema.parse(req.query);
    } catch (zodErr) {
      return next(zodErr);
    }

    const { meetings, pagination } = await MeetingService.getAllMeetings(
      userId,
      req.user?.organization || null,
      validatedQuery,
    );

    return sendSuccess(res, { meetings, pagination });
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   6. DELETE MEETING
   ───────────────────────────────────────────────────────────── */
export const deleteMeeting = async (req, res, next) => {
  try {
    await MeetingService.deleteMeeting(
      req.doc || null, // from requireOwnerOrAdmin middleware (may be undefined)
      req.params.id,
    );

    if (req.doc && req.doc.organization) {
      AuditService.logAction({
        actorId: getUserId(req),
        action: "MEETING_DELETED",
        entity: "Meeting",
        entityId: req.doc._id,
        organizationId: req.doc.organization,
        details: { title: req.doc.title },
      });

      const io = req.app.get("io");
      activityService.logActivity(
        io,
        req.doc.organization,
        getUserId(req),
        "meeting.deleted",
        "Meeting",
        req.doc._id,
        req.doc.title,
      );
    }

    return sendSuccess(res, null, "Meeting deleted successfully");
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   7. GET MEETING BY ID
   Used by: MeetingDetails.jsx
   ───────────────────────────────────────────────────────────── */
export const getMeetingById = async (req, res, next) => {
  try {
    getUserId(req); // ensure authenticated
    const meeting = await MeetingService.getMeetingById(req.params.id);
    return sendSuccess(res, { meeting });
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   8. UPDATE MEETING (Rename / edit fields)
   Used by: MeetingDetails.jsx
   ───────────────────────────────────────────────────────────── */
export const updateMeeting = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    let validated;
    try {
      validated = updateMeetingSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    const meeting = await MeetingService.updateMeeting(
      userId,
      req.params.id,
      validated,
      req.doc || null, // from requireOwner middleware
    );

    if (req.user?.organization) {
      const io = req.app.get("io");
      activityService.logActivity(
        io,
        req.user.organization,
        userId,
        "meeting.updated",
        "Meeting",
        meeting._id,
        meeting.title,
      );
    }

    return sendSuccess(
      res,
      {
        meeting: {
          _id: meeting._id,
          title: meeting.title,
          description: meeting.description,
          meetingType: meeting.meetingType,
          date: meeting.date,
        },
      },
      "Meeting updated successfully",
    );
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   9. VOICE / TEXT SEARCH
   Used by: Search page
   ───────────────────────────────────────────────────────────── */
export const searchMeetingsByText = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const orgId = req.user?.organization || null;

    let validated;
    try {
      validated = searchMeetingSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    const result = await MeetingService.searchMeetings(
      validated,
      orgId,
      userId,
    );

    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
    10. ARCHIVE MEETING
    ───────────────────────────────────────────────────────────── */
export const archiveMeeting = async (req, res, next) => {
  try {
    getUserId(req);
    const meeting = await MeetingService.archiveMeeting(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Meeting archived successfully",
      meeting: { _id: meeting._id, archived: meeting.archived },
    });
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
    11. RESTORE MEETING
    ───────────────────────────────────────────────────────────── */
export const restoreMeeting = async (req, res, next) => {
  try {
    getUserId(req);
    const meeting = await MeetingService.restoreMeeting(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Meeting restored successfully",
      meeting: { _id: meeting._id, archived: meeting.archived },
    });
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
    12. NOTIFY LIVE MEETING PARTICIPANTS
    ───────────────────────────────────────────────────────────── */
export const notifyLiveMeeting = async (req, res, next) => {
  try {
    const uploaderId = getUserId(req);

    let validated;
    try {
      validated = notifyLiveMeetingSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    const { count } = await MeetingService.notifyLiveMeetingParticipants(
      uploaderId,
      validated.roomId,
      validated.participants,
      req.user.organization,
    );

    return sendSuccess(res, { count }, "Participants notified");
  } catch (err) {
    next(err);
  }
};
