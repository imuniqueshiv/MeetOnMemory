import fs from "fs";
import path from "path";
import crypto from "crypto";
import UploadSession from "../models/uploadSessionModel.js";
import * as MeetingService from "../services/MeetingService.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "../utils/errors.js";
import { sendSuccess } from "../utils/responseHandler.js";

const ALLOWED_RECORDING_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "application/octet-stream",
];

const ALLOWED_RECORDING_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".webm",
  ".flac",
  ".aac",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
];

const validateFileNameAndType = (fileName, mimeType) => {
  if (!fileName) throw new ValidationError("File name is required");
  const ext = path.extname(fileName || "").toLowerCase();
  const isExtAllowed = ALLOWED_RECORDING_EXTENSIONS.includes(ext);
  const isMimeAllowed =
    !mimeType || ALLOWED_RECORDING_MIME_TYPES.includes(mimeType);

  if (!isExtAllowed || !isMimeAllowed) {
    throw new ValidationError(
      `Invalid meeting recording file format: ${fileName}. Supported formats: MP3, WAV, M4A, OGG, WEBM, FLAC, AAC, MP4, MOV, AVI, MKV`,
    );
  }
};

const getChunksDir = (uploadId) => {
  const chunksDir = path.resolve("uploads", "chunks", uploadId);
  if (!chunksDir.startsWith(path.resolve("uploads"))) {
    throw new ValidationError("Directory traversal detected");
  }
  return chunksDir;
};

/**
 * 1. Initialize Resumable Chunk Upload Session
 */
export const initResumableUpload = async (req, res, next) => {
  try {
    const { fileName, fileSize, totalChunks, title, tags, date, mimeType } =
      req.body;

    if (!fileName || !fileSize || !totalChunks) {
      throw new ValidationError(
        "fileName, fileSize, and totalChunks are required",
      );
    }

    validateFileNameAndType(fileName, mimeType);

    const userId = req.user.id || req.user._id;
    const orgId = req.user.organization || null;

    const uploadId = `upload_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const session = await UploadSession.create({
      uploadId,
      user: userId,
      organization: orgId,
      fileName,
      fileSize: Number(fileSize),
      totalChunks: Number(totalChunks),
      uploadedChunks: [],
      status: "in_progress",
      metadata: {
        title: title || "",
        tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
        date: date || "",
      },
    });

    const chunksDir = getChunksDir(uploadId);
    fs.mkdirSync(chunksDir, { recursive: true });

    return sendSuccess(
      res,
      {
        uploadId: session.uploadId,
        chunkSize: 5 * 1024 * 1024,
        totalChunks: session.totalChunks,
        uploadedChunks: [],
      },
      "Resumable upload session initialized",
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Upload Single Chunk
 */
export const uploadChunk = async (req, res, next) => {
  try {
    const { uploadId, chunkIndex: rawChunkIndex } = req.body;

    if (!uploadId || rawChunkIndex === undefined) {
      throw new ValidationError("uploadId and chunkIndex are required");
    }

    const chunkIndex = Number(rawChunkIndex);

    const session = await UploadSession.findOne({ uploadId });
    if (!session) {
      throw new NotFoundError("Upload session not found");
    }

    if (session.status !== "in_progress") {
      throw new ValidationError(
        `Upload session is no longer active (status: ${session.status})`,
      );
    }

    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new ValidationError(`Invalid chunkIndex ${chunkIndex}`);
    }

    const chunkBuffer =
      req.file?.buffer ||
      (req.file?.path ? fs.readFileSync(req.file.path) : null);
    if (!chunkBuffer) {
      throw new ValidationError("No chunk data provided");
    }

    const chunksDir = getChunksDir(uploadId);
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    const chunkFilePath = path.join(chunksDir, `chunk_${chunkIndex}.tmp`);
    fs.writeFileSync(chunkFilePath, chunkBuffer);

    // Clean up multer file path if temporary
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        // ignore
      }
    }

    if (!session.uploadedChunks.includes(chunkIndex)) {
      session.uploadedChunks.push(chunkIndex);
      session.uploadedChunks.sort((a, b) => a - b);
    }
    session.lastActiveAt = new Date();
    await session.save();

    return sendSuccess(
      res,
      {
        uploadId: session.uploadId,
        chunkIndex,
        uploadedChunks: session.uploadedChunks,
        totalChunks: session.totalChunks,
      },
      `Chunk ${chunkIndex} received`,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Get Upload Session Status (Rehydrate in-progress upload on refresh)
 */
export const getUploadStatus = async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user.id || req.user._id;

    const session = await UploadSession.findOne({ uploadId });
    if (!session) {
      throw new NotFoundError("Upload session not found");
    }

    if (session.user.toString() !== userId.toString()) {
      throw new ForbiddenError("You don't have access to this upload session");
    }

    return sendSuccess(res, {
      uploadId: session.uploadId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      uploadedChunks: session.uploadedChunks,
      status: session.status,
      metadata: session.metadata,
      lastActiveAt: session.lastActiveAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Complete & Assemble Chunks with Integrity Verification
 */
export const completeResumableUpload = async (req, res, next) => {
  let assembledFilePath = null;
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      throw new ValidationError("uploadId is required");
    }

    const session = await UploadSession.findOne({ uploadId });
    if (!session) {
      throw new NotFoundError("Upload session not found");
    }

    const userId = req.user.id || req.user._id;
    const orgId = req.user.organization || null;

    const chunksDir = getChunksDir(uploadId);

    // Verify all chunks 0..totalChunks-1 are uploaded
    const missingChunks = [];
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(chunksDir, `chunk_${i}.tmp`);
      if (!session.uploadedChunks.includes(i) || !fs.existsSync(chunkPath)) {
        missingChunks.push(i);
      }
    }

    if (missingChunks.length > 0) {
      throw new ValidationError(
        `Upload incomplete. Missing chunk indices: ${missingChunks.join(", ")}`,
      );
    }

    // Assemble file
    assembledFilePath = path.resolve(
      "uploads",
      `assembled_${uploadId}_${session.fileName}`,
    );
    const writeStream = fs.createWriteStream(assembledFilePath);

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(chunksDir, `chunk_${i}.tmp`);
      const chunkBuffer = fs.readFileSync(chunkPath);
      writeStream.write(chunkBuffer);
    }
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Integrity Check: Assembled size must match expected fileSize
    const assembledStat = fs.statSync(assembledFilePath);
    if (assembledStat.size !== session.fileSize) {
      throw new ValidationError(
        `File integrity check failed: expected size ${session.fileSize} bytes, got ${assembledStat.size} bytes`,
      );
    }

    // Call MeetingService uploadAndTranscribeMeeting
    const fakeFileObject = {
      path: assembledFilePath,
      originalname: session.fileName,
      size: assembledStat.size,
      mimetype: "audio/mpeg",
    };

    const validatedInput = {
      title: session.metadata?.title || undefined,
      tags: session.metadata?.tags || undefined,
      date: session.metadata?.date || undefined,
    };

    const { meeting, transcript } =
      await MeetingService.uploadAndTranscribeMeeting(
        userId,
        orgId,
        fakeFileObject,
        validatedInput,
      );

    session.status = "completed";
    await session.save();

    // Clean up chunk files and directory
    try {
      fs.rmSync(chunksDir, { recursive: true, force: true });
    } catch (_e) {
      // ignore
    }

    return sendSuccess(
      res,
      {
        meetingId: meeting._id,
        transcript,
        autoTitle: meeting.title,
      },
      "Resumable upload assembled and transcribed successfully",
    );
  } catch (err) {
    if (assembledFilePath && fs.existsSync(assembledFilePath)) {
      try {
        fs.unlinkSync(assembledFilePath);
      } catch (_e) {
        // ignore
      }
    }
    next(err);
  }
};

/**
 * 5. Abort Resumable Upload
 */
export const abortResumableUpload = async (req, res, next) => {
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      throw new ValidationError("uploadId is required");
    }

    const session = await UploadSession.findOne({ uploadId });
    if (session) {
      session.status = "aborted";
      await session.save();
    }

    const chunksDir = getChunksDir(uploadId);
    if (fs.existsSync(chunksDir)) {
      fs.rmSync(chunksDir, { recursive: true, force: true });
    }

    return sendSuccess(
      res,
      { uploadId },
      "Upload session aborted successfully",
    );
  } catch (err) {
    next(err);
  }
};
