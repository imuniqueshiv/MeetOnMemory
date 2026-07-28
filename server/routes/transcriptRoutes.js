import express from "express";
import Meeting from "../models/meetingModel.js";
import { requireOrgAccess, requirePermission } from "../middleware/rbac.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import {
  getTranscriptByMeeting,
  searchTranscript,
  exportTranscriptAsText,
  exportTranscriptAsPDF,
  finalizeTranscript,
  updateSpeakers,
} from "../controllers/transcriptController.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Mounted at /api/transcripts
// Recording/live endpoints live under /api/meetings (see meetingRoutes.js).
// Voice search lives under /api/search/voice (see searchRoutes.js).

// Get transcript by meeting ID
router.get(
  "/meeting/:meetingId",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getTranscriptByMeeting,
);

// Search within transcript
router.post(
  "/meeting/:meetingId/search",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  searchTranscript,
);

// Export transcript as text
router.get(
  "/meeting/:meetingId/export/text",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "export"),
  exportTranscriptAsText,
);

// Export transcript as PDF
router.get(
  "/meeting/:meetingId/export/pdf",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "export"),
  exportTranscriptAsPDF,
);

// Finalize transcript and index in Pinecone
router.post(
  "/meeting/:meetingId/finalize",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  finalizeTranscript,
);

// Update speaker names in transcript
router.put("/:id/speakers", userAuth, updateSpeakers);

export default router;
