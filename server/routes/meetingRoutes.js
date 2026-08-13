import express from "express";
import multer from "multer";
import Meeting from "../models/meetingModel.js";
import {
  requireOwnerOrAdmin,
  requireOwner,
  requireOrgAccess,
  requireAdminOrOwner,
  requirePermission,
  requireOrgMembership,
} from "../middleware/rbac.js";
import userAuth from "../middleware/userAuth.js";

import {
  validateMeeting,
  validateMeetingQuery,
  validateMeetingUpdate,
} from "../middleware/validation.js";

import {
  apiLimiter,
  writeLimiter,
  uploadLimiter,
} from "../middleware/rateLimiter.js";
import {
  createMeeting,
  uploadMeeting,
  uploadAudioForMeeting,
  summarizeMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  getDeletedMeetings,
  restoreDeletedMeeting,
  permanentlyDeleteMeeting,
  searchMeetingsByText,
  archiveMeeting,
  restoreMeeting,
  notifyLiveMeeting,
  handleMeetingClipOperation,
  getMeetingClip,
  getMeetingInvite,
  regenerateMeetingInvite,
  updateMeetingInvite,
  resolveMeetingInvite,
} from "../controllers/meetingController.js";
import {
  resendDigest,
  previewDigest,
} from "../controllers/digestController.js";
import {
  getReactionSummary,
  getReactionTimeline,
} from "../controllers/reactionController.js";
import { exportMeeting } from "../controllers/exportController.js";
import {
  startRecording,
  stopRecording,
  uploadTranscriptAudio,
  getTranscript,
  retryTranscription,
  uploadTranscriptChunk,
} from "../controllers/transcriptController.js";

import path from "path";
import { ValidationError } from "../utils/errors.js";

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

const meetingRecordingFilter = (req, file, cb) => {
  if (!file) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimeType = file.mimetype;

  const isExtAllowed = ALLOWED_RECORDING_EXTENSIONS.includes(ext);
  const isMimeAllowed =
    !mimeType || ALLOWED_RECORDING_MIME_TYPES.includes(mimeType);

  if (!isExtAllowed || !isMimeAllowed) {
    return cb(
      new ValidationError(
        `Invalid meeting recording file type: ${file.originalname || ext}. Allowed recording formats: MP3, WAV, M4A, OGG, WEBM, FLAC, AAC, MP4, MOV, AVI, MKV`,
      ),
      false,
    );
  }
  cb(null, true);
};

const router = express.Router();
const upload = multer({
  dest: "uploads/",
  fileFilter: meetingRecordingFilter,
});
const transcriptUpload = multer({
  dest: "uploads/transcripts/",
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: meetingRecordingFilter,
});
const transcriptChunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ========== VALIDATION MIDDLEWARE ==========
// All meeting routes now have input validation

// Apply rate limiting to all routes
router.use(apiLimiter);

// ========== RECORDING / LIVE TRANSCRIPT (Issue #679 contract) ==========

router.post(
  "/:meetingId/recording/start",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  startRecording,
);

router.post(
  "/:meetingId/recording/stop",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  stopRecording,
);

router.post(
  "/:meetingId/transcript/upload",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  transcriptUpload.single("audio"),
  uploadTranscriptAudio,
);

router.post(
  "/:meetingId/transcript/chunk",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  transcriptChunkUpload.single("audio"),
  uploadTranscriptChunk,
);

router.get(
  "/:meetingId/transcript",
  userAuth,
  requireOrgMembership,
  requirePermission("meetings", "view"),
  getTranscript,
);

router.post(
  "/:meetingId/transcript/retry",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  retryTranscription,
);

// ========== EXISTING ROUTES (Working) ==========

// Upload & Transcribe Meeting - admin only
router.post(
  "/upload",
  userAuth,
  requireAdminOrOwner,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  upload.single("file"),
  uploadMeeting,
);

// Summarize Transcript
router.post(
  "/summarize",
  userAuth,
  writeLimiter,
  requireOrgMembership,
  requirePermission("meetings", "transcribe"),
  summarizeMeeting,
);

// Fetch All Meetings
router.get(
  "/all",
  userAuth,
  requireOrgMembership,
  requirePermission("meetings", "view"),
  getAllMeetings,
);

// Resolve shareable meeting invite (must be before /:id)
router.get("/invite/:code", userAuth, resolveMeetingInvite);

// Meeting invite management (Issue #920)
router.get(
  "/:id/invite",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getMeetingInvite,
);
router.post(
  "/:id/invite/regenerate",
  userAuth,
  writeLimiter,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  regenerateMeetingInvite,
);
router.patch(
  "/:id/invite",
  userAuth,
  writeLimiter,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  updateMeetingInvite,
);

// Recycle bin routes
router.get(
  "/trash",
  userAuth,
  requireOrgMembership,
  requirePermission("meetings", "view"),
  getDeletedMeetings,
);
router.post(
  "/:id/restore-deleted",
  userAuth,
  writeLimiter,
  requireOrgMembership,
  requirePermission("meetings", "edit"),
  restoreDeletedMeeting,
);
router.delete(
  "/:id/permanent",
  userAuth,
  writeLimiter,
  requireAdminOrOwner,
  requireOrgMembership,
  permanentlyDeleteMeeting,
);

// ========== MEETING CRUD ROUTES WITH VALIDATION ==========

// Get Single Meeting Details
router.get(
  "/:id",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getMeetingById,
);

// ✅ Update Meeting with validation
router.patch(
  "/:id",
  userAuth,
  validateMeetingUpdate,  // ✅ Added validation
  requireOwner(Meeting),
  requirePermission("meetings", "edit"),
  updateMeeting,
);

// Export Meeting
router.get(
  "/:id/export",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "export"),
  exportMeeting,
);

// Archive Meeting
router.patch(
  "/:id/archive",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  requirePermission("meetings", "edit"),
  archiveMeeting,
);

// Restore Meeting
router.patch(
  "/:id/restore",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  requirePermission("meetings", "edit"),
  restoreMeeting,
);

// Delete Meeting
router.delete(
  "/delete/:id",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  requirePermission("meetings", "delete"),
  deleteMeeting,
);

// ========== NEW ROUTES (for CreateMeeting.jsx) ==========

// ✅ Create/Schedule Meeting with validation
router.post(
  "/create",
  userAuth,
  validateMeeting,  // ✅ Added validation
  writeLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  createMeeting,
);

// Upload Audio for existing meeting
router.post(
  "/upload-audio",
  userAuth,
  requireAdminOrOwner,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  upload.single("audio"),
  uploadAudioForMeeting,
);

// Voice/Text Search Route
router.post(
  "/search",
  userAuth,
  requireOrgMembership,
  requirePermission("meetings", "view"),
  searchMeetingsByText,
);

// Update Meeting Route with validation
router.put(
  "/:id",
  userAuth,
  validateMeetingUpdate,  // ✅ Added validation
  writeLimiter,
  requireOwner(Meeting),
  requirePermission("meetings", "edit"),
  updateMeeting,
);

// Notify Live Meeting Participants
router.post(
  "/notify-live",
  userAuth,
  writeLimiter,
  requirePermission("meetings", "create"),
  notifyLiveMeeting,
);

// Create/Modify Meeting Clip
router.post(
  "/:id/clip",
  userAuth,
  requireOrgMembership,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  handleMeetingClipOperation,
);

// View Meeting Clip
router.get(
  "/:id/clip/:clipId",
  userAuth,
  requireOrgMembership,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getMeetingClip,
);

// Resend Meeting Digest
router.post(
  "/:id/digest/resend",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  resendDigest,
);

// Preview Meeting Digest
router.get(
  "/:id/digest/preview",
  userAuth,
  requireOwnerOrAdmin(Meeting),
  previewDigest,
);

// Get Reaction Summary
router.get(
  "/:id/reactions/summary",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getReactionSummary,
);

// Get Reaction Timeline
router.get(
  "/:id/reactions/timeline",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getReactionTimeline,
);

export default router;