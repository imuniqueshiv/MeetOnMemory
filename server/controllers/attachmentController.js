import fs from "fs";
import path from "path";
import { z } from "zod";
import Attachment from "../models/attachmentModel.js";
import Meeting from "../models/meetingModel.js";
import { fileURLToPath } from "url";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.resolve(__dirname, "..", "uploads", "attachments");

const getSafeFilePath = (unsafePath) => {
  if (!unsafePath) return null;
  const filename = path.basename(unsafePath);
  const safePath = path.resolve(UPLOADS_DIR, filename);
  if (!safePath.startsWith(UPLOADS_DIR)) {
    throw new Error("Path traversal detected");
  }
  return safePath;
};

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
];

const attachmentSchema = z.object({
  meetingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid meeting ID"),
});

export const uploadAttachment = async (req, res) => {
  try {
    const { meetingId } = req.params;

    // Validate meeting ID
    const validationResult = attachmentSchema.safeParse({ meetingId });
    if (!validationResult.success) {
      if (req.file) {
        fs.unlinkSync(getSafeFilePath(req.file.path));
      }
      return res.status(400).json({
        success: false,
        message: validationResult.error.errors[0].message,
      });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file provided" });
    }

    if (req.file.size > MAX_FILE_SIZE) {
      fs.unlinkSync(getSafeFilePath(req.file.path));
      return res
        .status(400)
        .json({ success: false, message: "File exceeds 10 MB limit" });
    }

    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      fs.unlinkSync(getSafeFilePath(req.file.path));
      return res
        .status(400)
        .json({ success: false, message: "Invalid file type" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      fs.unlinkSync(getSafeFilePath(req.file.path));
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    // Since we're using requireOrgAccess on routes, user is already authorized
    const newAttachment = new Attachment({
      meeting: meetingId,
      uploadedBy: req.user._id,
      fileName: req.file.originalname,
      fileType:
        path.extname(req.file.originalname).toLowerCase().replace(".", "") ||
        "unknown",
      fileSize: req.file.size,
      filePath: getSafeFilePath(req.file.path),
      mimeType: req.file.mimetype,
    });

    await newAttachment.save();

    res.status(201).json({
      success: true,
      message: "Attachment uploaded successfully",
      attachment: newAttachment,
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(getSafeFilePath(req.file.path));
    }
    console.error("Error uploading attachment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during upload" });
  }
};

export const listAttachments = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
    });

    const attachments = await Attachment.find({ meeting: meetingId })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Attachment.countDocuments({ meeting: meetingId });

    res.status(200).json({
      success: true,
      attachments,
      pagination: buildPaginationMeta({ total, page, limit }),
    });
  } catch (error) {
    console.error("Error listing attachments:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error listing attachments" });
  }
};

export const downloadAttachment = async (req, res) => {
  try {
    const { meetingId, id } = req.params;

    const attachment = await Attachment.findOne({
      _id: id,
      meeting: meetingId,
    });
    if (!attachment) {
      return res
        .status(404)
        .json({ success: false, message: "Attachment not found" });
    }

    const safePath = getSafeFilePath(attachment.filePath);
    if (!fs.existsSync(safePath)) {
      return res
        .status(404)
        .json({ success: false, message: "File not found on server" });
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.fileName}"`,
    );
    res.setHeader("Content-Type", attachment.mimeType);

    const fileStream = fs.createReadStream(safePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error downloading attachment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during download" });
  }
};

export const deleteAttachment = async (req, res) => {
  try {
    const { meetingId, id } = req.params;

    const attachment = await Attachment.findOne({
      _id: id,
      meeting: meetingId,
    }).populate("meeting");
    if (!attachment) {
      return res
        .status(404)
        .json({ success: false, message: "Attachment not found" });
    }

    // Check authorization: must be uploader OR admin/owner of the org
    const isOwner =
      attachment.uploadedBy.toString() === req.user._id.toString();
    const isAdminOrOwner =
      req.user.role === "admin" || req.user.role === "owner";

    // Check org match for admin/owner
    let orgMatch = false;
    if (
      attachment.meeting &&
      attachment.meeting.organization &&
      req.user.organization
    ) {
      orgMatch =
        attachment.meeting.organization.toString() ===
        req.user.organization.toString();
    }

    if (!isOwner && !(isAdminOrOwner && orgMatch)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Not authorized to delete this attachment",
      });
    }

    // Delete file from disk
    const safePath = getSafeFilePath(attachment.filePath);
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }

    await Attachment.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: "Attachment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during deletion" });
  }
};
