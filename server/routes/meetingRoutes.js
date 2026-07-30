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
  apiLimiter,
  writeLimiter,
  uploadLimiter,
} from "../middleware/rateLimiter.js";
import {
  createMeeting, // NEW: Schedule meetings from CreateMeeting form
  uploadMeeting, // EXISTING: Upload audio and transcribe
  uploadAudioForMeeting, // NEW: Upload audio for existing meeting
  summarizeMeeting, // EXISTING: Generate AI summary/MOM
  getAllMeetings,
  getMeetingById, // NEW: Get single meeting details
  updateMeeting, // NEW: Update meeting (rename)
  deleteMeeting, // EXISTING: Delete meeting
  searchMeetingsByText, // 🆕 NEW: Voice/Text Search
  archiveMeeting,
  restoreMeeting,
  notifyLiveMeeting, // NEW: Notify participants of a live meeting
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

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temporary upload directory
const transcriptUpload = multer({
  dest: "uploads/transcripts/",
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});
const transcriptChunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit per chunk
});

// Apply rate limiting to all routes
router.use(apiLimiter);

// ========== RECORDING / LIVE TRANSCRIPT (Issue #679 contract) ==========
// Frontend expects these under /api/meetings/:meetingId/...

// POST /api/meetings/:meetingId/recording/start
router.post(
  "/:meetingId/recording/start",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  startRecording,
);

// POST /api/meetings/:meetingId/recording/stop
router.post(
  "/:meetingId/recording/stop",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  stopRecording,
);

// POST /api/meetings/:meetingId/transcript/upload
router.post(
  "/:meetingId/transcript/upload",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  transcriptUpload.single("audio"),
  uploadTranscriptAudio,
);

// POST /api/meetings/:meetingId/transcript/chunk
router.post(
  "/:meetingId/transcript/chunk",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  transcriptChunkUpload.single("audio"),
  uploadTranscriptChunk,
);

// GET /api/meetings/:meetingId/transcript
router.get(
  "/:meetingId/transcript",
  userAuth,
  requireOrgMembership,
  requirePermission("meetings", "view"),
  getTranscript,
);

// POST /api/meetings/:meetingId/transcript/retry
router.post(
  "/:meetingId/transcript/retry",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  retryTranscription,
);

// ========== EXISTING ROUTES (Working) ==========

// ✅ Upload & Transcribe Meeting (from UploadMeetings page) - admin only
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

// ✅ Summarize Transcript (send meetingId or transcript)
router.post(
  "/summarize",
  userAuth,
  writeLimiter,
  requireOrgMembership,
  requirePermission("meetings", "transcribe"),
  summarizeMeeting,
);

// ✅ Fetch All Meetings (for Summaries Page)
router.get(
  "/all",
  userAuth,
  requireOrgMembership,
  requirePermission("meetings", "view"),
  getAllMeetings,
);

// ✅ Get Single Meeting Details (for Meeting Details Page)
router.get(
  "/:id",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getMeetingById,
);

// ✅ Update Meeting (for Meeting Details Page - rename)
router.patch(
  "/:id",
  userAuth,
  requireOwner(Meeting),
  requirePermission("meetings", "edit"),
  updateMeeting,
);

// ✅ Export Meeting
router.get(
  "/:id/export",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "export"),
  exportMeeting,
);

// ✅ Archive Meeting
router.patch(
  "/:id/archive",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  requirePermission("meetings", "edit"),
  archiveMeeting,
);

// ✅ Restore Meeting
router.patch(
  "/:id/restore",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  requirePermission("meetings", "edit"),
  restoreMeeting,
);

// ✅ Delete Meeting
router.delete(
  "/delete/:id",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  requirePermission("meetings", "delete"),
  deleteMeeting,
);

// ========== NEW ROUTES (for CreateMeeting.jsx) ==========

// ✅ Create/Schedule Meeting (from CreateMeeting Schedule section)
router.post(
  "/create",
  userAuth,
  writeLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  createMeeting,
);

// ✅ Upload Audio for existing meeting (from CreateMeeting Upload section) - admin only
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

// 🆕 ✅ Voice/Text Search Route (Frontend: Summaries.jsx or Live Search)
router.post(
  "/search",
  userAuth,
  requireOrgMembership,
  requirePermission("meetings", "view"),
  searchMeetingsByText,
);

// 🆕 ✅ Update Meeting Route (Frontend: Meeting Repository - rename, etc.)
router.put(
  "/:id",
  userAuth,
  writeLimiter,
  requireOwner(Meeting),
  requirePermission("meetings", "edit"),
  updateMeeting,
);

// ✅ Notify Live Meeting Participants (from CreateMeeting Live section)
router.post(
  "/notify-live",
  userAuth,
  writeLimiter,
  requirePermission("meetings", "create"),
  notifyLiveMeeting,
);

// ✅ Resend Meeting Digest
router.post(
  "/:id/digest/resend",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  resendDigest,
);

// ✅ Preview Meeting Digest
router.get(
  "/:id/digest/preview",
  userAuth,
  requireOwnerOrAdmin(Meeting),
  previewDigest,
);

// ✅ Get Reaction Summary
router.get(
  "/:id/reactions/summary",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getReactionSummary,
);

// ✅ Get Reaction Timeline
router.get(
  "/:id/reactions/timeline",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getReactionTimeline,
);

export default router;
