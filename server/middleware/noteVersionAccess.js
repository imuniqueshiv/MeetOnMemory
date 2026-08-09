/**
 * Authorization for the note-version API (Issue #1158).
 *
 * `noteVersionRoutes.js` applied `userAuth` and nothing else, and none of the
 * five handlers checked anything themselves. Every id in the path was trusted,
 * so any authenticated user could read any organization's collaborative notes
 * and AI summaries — and, through `restoreVersion`, overwrite them.
 *
 * The `/:meetingId/...` route can use the existing `requireOrgAccess(Meeting)`,
 * because the meeting id is right there in the path. The `/version/:versionId`
 * routes cannot: `NoteVersion` carries no `organization` field, so the tenant
 * boundary has to be resolved through `meetingId -> Meeting.organization`.
 * That is what this module does.
 *
 * The access rule itself is deliberately *not* re-implemented here. It is
 * imported from `rbac.js`, so "who may see this meeting" has one definition and
 * these routes cannot drift away from the rest of the API.
 */

import mongoose from "mongoose";
import NoteVersion from "../models/noteVersionModel.js";
import Meeting from "../models/meetingModel.js";
import { canAccessMeetingDoc } from "./rbac.js";

/** The only two fields `NoteVersion.field` is allowed to hold. */
export const VERSIONED_FIELDS = ["collaborativeNotes", "summary"];

/**
 * Rejects a `:field` path segment that is not one of the versioned fields.
 *
 * Without this, `GET /api/note-versions/<id>/crdtState/history` reaches the
 * database with an arbitrary string and returns an empty list, which reads as
 * "this meeting has no history" rather than "that is not a field".
 */
export const requireVersionedField = (req, res, next) => {
  const { field } = req.params;

  if (!VERSIONED_FIELDS.includes(field)) {
    return res.status(400).json({
      success: false,
      message: `Unknown versioned field '${field}'. Expected one of: ${VERSIONED_FIELDS.join(", ")}.`,
    });
  }

  next();
};

/**
 * Loads the `NoteVersion` named by `:versionId`, resolves the meeting behind
 * it, and applies the same access rule the rest of the API uses.
 *
 * On success attaches `req.noteVersion` and `req.meeting` so the handler does
 * not repeat either lookup.
 */
export const requireNoteVersionAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.user.organization) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Organization membership required",
      });
    }

    const { versionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(versionId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid version ID format" });
    }

    const noteVersion = await NoteVersion.findById(versionId);
    if (!noteVersion) {
      return res
        .status(404)
        .json({ success: false, message: "Version not found" });
    }

    const meeting = await Meeting.findById(noteVersion.meetingId);
    if (!meeting) {
      // A version whose meeting has been hard-deleted is unreachable content,
      // not a 500. Reported as 404 so it is indistinguishable from a version
      // id that never existed — a caller probing ids learns nothing either way.
      return res
        .status(404)
        .json({ success: false, message: "Version not found" });
    }

    if (!canAccessMeetingDoc(meeting, req.user)) {
      // Same message and status as an unknown id, for the same reason: the
      // difference between "exists but is not yours" and "does not exist" is
      // exactly what makes id enumeration worthwhile.
      return res
        .status(404)
        .json({ success: false, message: "Version not found" });
    }

    req.noteVersion = noteVersion;
    req.meeting = meeting;
    next();
  } catch (error) {
    console.error("requireNoteVersionAccess error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during authorization check",
    });
  }
};

export default requireNoteVersionAccess;
