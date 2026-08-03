import crypto from "crypto";
import * as diff from "diff";
import NoteVersion from "../models/noteVersionModel.js";
import Meeting from "../models/meetingModel.js";
import { sendSuccess } from "../utils/responseHandler.js";
import { NotFoundError } from "../utils/errors.js";

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

export const getVersionHistory = async (req, res, next) => {
  try {
    const { meetingId, field } = req.params;

    // Fetch all versions but exclude the actual content to keep response light
    const versions = await NoteVersion.find({ meetingId, field })
      .select("-content")
      .populate("changedBy", "name email")
      .sort({ version: -1 })
      .exec();

    return sendSuccess(res, { versions });
  } catch (err) {
    next(err);
  }
};

export const getVersionContent = async (req, res, next) => {
  try {
    const { versionId } = req.params;
    const version = await NoteVersion.findById(versionId).populate(
      "changedBy",
      "name email",
    );

    if (!version) {
      throw new NotFoundError("Version not found");
    }

    return sendSuccess(res, { version });
  } catch (err) {
    next(err);
  }
};

export const getVersionDiff = async (req, res, next) => {
  try {
    const { versionId, compareVersionId } = req.params;

    const v1 = await NoteVersion.findById(versionId);
    const v2 = compareVersionId
      ? await NoteVersion.findById(compareVersionId)
      : null;

    if (!v1) throw new NotFoundError("Base version not found");

    // If compareVersionId is provided but not found, we throw error. If not provided, we compare with previous version.
    let baseContent = v1.content;
    let compareContent = "";

    if (v2) {
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
    const diffResult = diff.diffLines(compareContent, baseContent);

    return sendSuccess(res, { diff: diffResult });
  } catch (err) {
    next(err);
  }
};

export const restoreVersion = async (req, res, next) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id || req.user?._id;

    const versionToRestore = await NoteVersion.findById(versionId);
    if (!versionToRestore) {
      throw new NotFoundError("Version not found");
    }

    const meeting = await Meeting.findById(versionToRestore.meetingId);
    if (!meeting) {
      throw new NotFoundError("Meeting not found");
    }

    // Restore content to the meeting
    if (versionToRestore.field === "collaborativeNotes") {
      meeting.collaborativeNotes = versionToRestore.content;
      // Note: we are only updating the plain text here. If CRDT state exists,
      // it might need to be reset or a new Yjs document created, but for simplicity
      // and as a fallback we update the plain text.
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
