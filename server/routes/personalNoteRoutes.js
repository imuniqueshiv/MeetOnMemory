import express from "express";
import {
  getNoteByMeetingId,
  upsertNote,
  addAnnotation,
  removeAnnotation,
  togglePin,
  getPinnedNotes,
  searchNotes,
} from "../controllers/personalNoteController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// All routes require authentication
router.use(userAuth);

// Get pinned notes (must be before /:meetingId to avoid route collision)
router.get("/pinned", getPinnedNotes);

// Search notes (must be before /:meetingId to avoid route collision)
router.get("/search", searchNotes);

// Get note for a specific meeting
router.get("/:meetingId", getNoteByMeetingId);

// Upsert note for a specific meeting
router.post("/:meetingId", upsertNote);

// Add annotation
router.post("/:meetingId/annotations", addAnnotation);

// Remove annotation
router.delete("/:meetingId/annotations/:annotationId", removeAnnotation);

// Toggle pin status
router.patch("/:meetingId/pin", togglePin);

export default router;
