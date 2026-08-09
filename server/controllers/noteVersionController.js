import crypto from "crypto";
import mongoose from "mongoose";
import * as diff from "diff";
import NoteVersion from "../models/noteVersionModel.js";
import { sendSuccess } from "../utils/responseHandler.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";

/**
 * `socket/documentSync.js` is imported lazily, on the one code path that needs
 * it, for two reasons: `documentService.js` already imports `snapshotNoteVersion`
 * from this file (so a static import would close a cycle), and `documentSync`
 * performs a top-level `await` on a Redis connection that no other handler in
 * this controller should be made to wait for.
 */
const loadDocumentSync = () => import("../socket/documentSync.js");

// Helper to hash content
const hashContent = (content) => {
  return crypto
    .createHash("sha256")
    .update(content || "")
    .digest("hex");
};

/**
 * Creates a new version snapshot if the content has changed.
 * @param {string} meetingId - The ID of the meeting.
 * @param {string} field - The field being versioned ('collaborativeNotes' or 'summary').
 * @param {string} newContent - The new content of the field.
 * @param {string} changeSource - The source of the change ('user_edit', 'ai_processing', 'system').
 * @param {string} changedBy - The ID of the user who made the change.
 */
export const snapshotNoteVersion = async (
  meetingId,
  field,
  newContent,
  changeSource = "system",
  changedBy = null,
) => {
  if (!["collaborativeNotes", "summary"].includes(field)) return null;

  const newHash = hashContent(newContent);

  // Get the latest version to compare
  const latestVersion = await NoteVersion.findOne({ meetingId, field })
    .sort({ version: -1 })
    .exec();

  if (latestVersion && latestVersion.contentHash === newHash) {
    // Content hasn't changed
    return latestVersion;
  }

  const nextVersionNum = latestVersion ? latestVersion.version + 1 : 1;
  const previousContent = latestVersion ? latestVersion.content : "";
  const bytesDiff =
    Buffer.byteLength(newContent || "", "utf8") -
    Buffer.byteLength(previousContent || "", "utf8");

  const newVersion = new NoteVersion({
    meetingId,
    field,
    version: nextVersionNum,
    content: newContent || "",
    contentHash: newHash,
    changeSource,
    changedBy,
    bytesDiff,
  });

  await newVersion.save();
  return newVersion;
};

// --- HTTP Routes ---

/**
 * Authorization for every handler below lives in the route definition
 * (Issue #1158): `requireOrgAccess(Meeting)` for the `/:meetingId` route,
 * `requireNoteVersionAccess` for the `/version/:versionId` routes. The latter
 * attaches `req.noteVersion` and `req.meeting`, so these handlers no longer
 * re-fetch either — and, more to the point, no longer read a document the
 * caller has not been cleared for.
 */

export const getVersionHistory = async (req, res, next) => {
  try {
    const { meetingId, field } = req.params;

    // The history used to be unbounded. A long collaborative meeting writes a
    // snapshot per edit burst — `saveDocumentState` calls `snapshotNoteVersion`
    // on every debounced flush — so this list grows without limit for exactly
    // the meetings anyone would want to inspect.
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const filter = { meetingId, field };

    const [versions, total] = await Promise.all([
      NoteVersion.find(filter)
        .select("-content")
        .populate("changedBy", "name email")
        .sort({ version: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      NoteVersion.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      versions,
      pagination: buildPaginationMeta({ total, page, limit }),
    });
  } catch (err) {
    next(err);
  }
};

export const getVersionContent = async (req, res, next) => {
  try {
    // Loaded and access-checked by `requireNoteVersionAccess`.
    const version = await req.noteVersion.populate("changedBy", "name email");

    return sendSuccess(res, { version });
  } catch (err) {
    next(err);
  }
};

export const getVersionDiff = async (req, res, next) => {
  try {
    const { compareVersionId } = req.params;
    const v1 = req.noteVersion;

    let compareContent = "";

    if (compareVersionId) {
      if (!mongoose.Types.ObjectId.isValid(compareVersionId)) {
        throw new ValidationError("Invalid comparison version ID format");
      }

      const v2 = await NoteVersion.findById(compareVersionId);
      if (!v2) {
        throw new NotFoundError("Comparison version not found");
      }

      // Only `versionId` passes through `requireNoteVersionAccess`, so without
      // this the endpoint would happily diff one organization's content
      // against another's — and the diff output contains both sides.
      if (
        v2.meetingId.toString() !== v1.meetingId.toString() ||
        v2.field !== v1.field
      ) {
        throw new ValidationError(
          "Versions must belong to the same meeting and field to be compared",
        );
      }

      compareContent = v2.content;
    } else {
      // Find the version right before v1
      const prevVersion = await NoteVersion.findOne({
        meetingId: v1.meetingId,
        field: v1.field,
        version: v1.version - 1,
      });
      if (prevVersion) {
        compareContent = prevVersion.content;
      }
    }

    // diffLines computes differences line by line
    const diffResult = diff.diffLines(compareContent, v1.content);

    return sendSuccess(res, { diff: diffResult });
  } catch (err) {
    next(err);
  }
};

export const restoreVersion = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;

    // Both loaded and access-checked by `requireNoteVersionAccess`.
    const versionToRestore = req.noteVersion;
    const meeting = req.meeting;

    // Restore content to the meeting
    if (versionToRestore.field === "collaborativeNotes") {
      // Writing only the plain-text column is what made this restore revert:
      // `getOrCreateDoc` rehydrates from `crdtState`, so the next client to
      // open the notes reinstated the pre-restore text and the debounced save
      // wrote it back. Rebuilding the CRDT is what makes the restore stick.
      const { restoreCollaborativeNotes } = await loadDocumentSync();
      const { state } = await restoreCollaborativeNotes(
        meeting._id.toString(),
        versionToRestore.content,
      );

      meeting.collaborativeNotes = versionToRestore.content;
      meeting.crdtState = state;
    } else if (versionToRestore.field === "summary") {
      meeting.summary = versionToRestore.content;
    }

    await meeting.save();

    // Create a new snapshot for this restoration
    const newSnapshot = await snapshotNoteVersion(
      meeting._id,
      versionToRestore.field,
      versionToRestore.content,
      "user_edit",
      userId,
    );

    return sendSuccess(
      res,
      { meeting, newSnapshot },
      "Version restored successfully",
    );
  } catch (err) {
    next(err);
  }
};
