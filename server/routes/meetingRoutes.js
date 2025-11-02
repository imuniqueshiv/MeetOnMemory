// server/routes/meetingRoutes.js
import express from "express";
import {
  uploadMeeting,
  summarizeMeeting,
  getAllMeetings, // ✅ new import
} from "../controllers/meetingController.js";
import multer from "multer";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temporary upload directory

// ✅ Upload & Transcribe Meeting
router.post("/upload", userAuth, upload.single("file"), uploadMeeting);

// ✅ Summarize Transcript (send meetingId or transcript)
router.post("/summarize", userAuth, summarizeMeeting);

// ✅ Fetch All Meetings (for Summaries Page)
router.get("/all", userAuth, getAllMeetings);

export default router;
