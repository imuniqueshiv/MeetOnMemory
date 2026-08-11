import mongoose from "mongoose";
import { transcriptAnnotationService } from "../services/transcriptAnnotationService.js";
import TranscriptAnnotation from "../models/transcriptAnnotationModel.js";
import Meeting from "../models/meetingModel.js";
import { canAccessMeetingDoc } from "../middleware/rbac.js";

/**
 * Roles that may moderate someone else's annotation *within their own
 * organization* (Issue #1274).
 *
 * The previous check was:
 *
 *     annotation.author.toString() !== req.user._id.toString() &&
 *     req.user.role !== "admin"
 *
 * `req.user.role` is the caller's role in *their* organization, not in the
 * annotation's. Nothing established that the two were the same, so an `admin`
 * of org B satisfied it for an annotation in org A. The list of roles was also
 * wrong in the other direction: an org `owner` — strictly more privileged than
 * an admin — could not moderate annotations in their own organization, and
 * neither could a `moderator`.
 *
 * Ordering matters more than the list. Organization access is established
 * first, so by the time this is consulted the caller is already known to belong
 * to the meeting's organization and the role means what it appears to mean.
 */
const MODERATOR_ROLES = new Set(["owner", "admin", "moderator"]);

/**
 * Resolves the annotation at `:id` and the meeting it belongs to, and confirms
 * the caller may see that meeting.
 *
 * Returns `null` after responding, so callers can `if (!ctx) return;`.
 *
 * `TranscriptAnnotation` carries no `organization` field of its own — the
 * tenant boundary lives on the meeting — so every check has to route through
 * the meeting. That indirection is presumably why the four write handlers ended
 * up with no check at all.
 */
const loadAccessibleAnnotation = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, message: "Invalid annotation ID" });
    return null;
  }

  const annotation = await TranscriptAnnotation.findById(id);
  if (!annotation) {
    res.status(404).json({ success: false, message: "Annotation not found" });
    return null;
  }

  const meeting = await Meeting.findById(annotation.meeting);

  // A 404 rather than a 403: telling a cross-tenant caller "this exists, but
  // not for you" confirms the id is real.
  if (!meeting || !canAccessMeetingDoc(meeting, req.user)) {
    res.status(404).json({ success: false, message: "Annotation not found" });
    return null;
  }

  return { annotation, meeting };
};

/**
 * True when the caller may modify an annotation they can already see.
 */
const canModerate = (annotation, user) =>
  annotation.author.toString() === user._id.toString() ||
  MODERATOR_ROLES.has(user.role);

export const createAnnotation = async (req, res) => {
  try {
    const {
      transcript,
      meeting,
      type,
      body,
      color,
      startTime,
      endTime,
      segmentIndex,
    } = req.body;
    const author = req.user._id;

    if (
      !transcript ||
      !meeting ||
      !type ||
      startTime === undefined ||
      endTime === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (
      !mongoose.Types.ObjectId.isValid(transcript) ||
      !mongoose.Types.ObjectId.isValid(meeting)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid transcript or meeting ID" });
    }

    // Authorize the *caller* against the target meeting (Issue #1274).
    //
    // `transcript` and `meeting` arrive from the request body, and the service
    // only ever checked that the two were consistent with each other:
    //
    //     if (transcript.meeting.toString() !== data.meeting.toString())
    //
    // Two ids belonging to the same foreign meeting satisfy that perfectly.
    // Nothing asked whether the caller could see it, so any authenticated user
    // could attach free-text annotations to any organization's transcript, and
    // they then rendered in that organization's transcript viewer.
    const targetMeeting = await Meeting.findById(meeting);
    if (!targetMeeting || !canAccessMeetingDoc(targetMeeting, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: meeting not accessible" });
    }

    const annotation = await transcriptAnnotationService.createAnnotation({
      transcript,
      meeting,
      author,
      type,
      body,
      color,
      startTime,
      endTime,
      segmentIndex,
    });

    res.status(201).json({ success: true, annotation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const listAnnotations = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { type, author, resolved } = req.query;

    // The route already runs `requireOrgAccess(Meeting)`, so the meeting itself
    // is authorized by the time this executes.
    const query = { meeting: meetingId };
    if (type) query.type = type;

    if (author) {
      // A non-ObjectId `author` produced an unhandled CastError and a 500.
      if (!mongoose.Types.ObjectId.isValid(author)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid author ID" });
      }
      query.author = author;
    }

    if (resolved !== undefined) query.resolved = resolved === "true";

    const annotations =
      await transcriptAnnotationService.listAnnotations(query);
    res.status(200).json({ success: true, annotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAnnotation = async (req, res) => {
  try {
    const context = await loadAccessibleAnnotation(req, res);
    if (!context) return;

    const { body, color, type } = req.body;

    if (!canModerate(context.annotation, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this annotation",
      });
    }

    const annotation = await transcriptAnnotationService.updateAnnotation(
      req.params.id,
      { body, color, type },
    );
    res.status(200).json({ success: true, annotation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteAnnotation = async (req, res) => {
  try {
    const context = await loadAccessibleAnnotation(req, res);
    if (!context) return;

    if (!canModerate(context.annotation, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this annotation",
      });
    }

    await transcriptAnnotationService.deleteAnnotation(req.params.id);
    res.status(200).json({ success: true, message: "Annotation deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveAnnotation = async (req, res) => {
  try {
    // This handler previously had no check of any kind: it loaded by id and
    // toggled `resolved`, stamping `resolvedBy` with the caller. Any user could
    // mark any organization's annotations resolved, or un-resolve them, and be
    // recorded as having done so.
    //
    // Resolving is a collaborative action rather than an edit, so anyone who
    // can see the meeting may do it — the check is organization access, not
    // authorship.
    const context = await loadAccessibleAnnotation(req, res);
    if (!context) return;

    const annotation = await transcriptAnnotationService.resolveAnnotation(
      req.params.id,
      req.user._id,
    );
    res.status(200).json({ success: true, annotation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
