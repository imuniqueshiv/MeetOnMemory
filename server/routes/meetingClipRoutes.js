import express from "express";
import {
  createClip,
  getClipsForMeeting,
  updateClip,
  deleteClip,
  addAnnotation,
} from "../controllers/meetingClipController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// All clip routes require authentication
router.use(userAuth);

// Base route is /api/clips
router.post("/", createClip);
router.get("/meeting/:meetingId", getClipsForMeeting);
router.put("/:clipId", updateClip);
router.delete("/:clipId", deleteClip);
router.post("/:clipId/annotations", addAnnotation);

export default router;
