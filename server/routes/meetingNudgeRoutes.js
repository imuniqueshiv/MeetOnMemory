import express from "express";
import {
  getMyNudges,
  updateNudge,
  getReadiness,
  getMeetingNudgesPreview,
  triggerMeetingNudgesManual,
  updateMeetingNudgeSettings,
} from "../controllers/meetingNudgeController.js";
import protect from "../middleware/userAuth.js";

const router = express.Router();

router.use(protect);

router.get("/", getMyNudges);
router.patch("/:id/status", updateNudge);
router.get("/meeting/:meetingId/readiness", getReadiness);

// Issue #2062 — Organizer controls
router.get("/meeting/:meetingId/preview", getMeetingNudgesPreview);
router.post("/meeting/:meetingId/trigger", triggerMeetingNudgesManual);
router.patch("/meeting/:meetingId/settings", updateMeetingNudgeSettings);

export default router;
