// server/routes/meetingRoutes.js
import express from "express";
import { 
  createMeeting,           // NEW: Schedule meetings from CreateMeeting form
  uploadMeeting,           // EXISTING: Upload audio and transcribe
  uploadAudioForMeeting,   // NEW: Upload audio for existing meeting
  summarizeMeeting,        // EXISTING: Generate AI summary/MOM
  getAllMeetings,
  deleteMeeting          // EXISTING: Fetch all meetings
} from "../controllers/meetingController.js";
import multer from "multer";
import userAuth from "../middleware/userAuth.js";





const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temporary upload directory

// ========== EXISTING ROUTES (Working) ==========
// ✅ Upload & Transcribe Meeting (from UploadMeetings page)
router.post("/upload", userAuth, upload.single("file"), uploadMeeting);

// ✅ Summarize Transcript (send meetingId or transcript)
router.post("/summarize", userAuth, summarizeMeeting);

// ✅ Fetch All Meetings (for Summaries Page)
router.get("/all", userAuth, getAllMeetings);

// ========== NEW ROUTES (for CreateMeeting.jsx) ==========
// ✅ Create/Schedule Meeting (from CreateMeeting Schedule section)
router.post("/create", userAuth, createMeeting);

// ✅ Upload Audio for existing meeting (from CreateMeeting Upload section)
router.post("/upload-audio", userAuth, upload.single("audio"), uploadAudioForMeeting);
router.delete("/delete/:id", deleteMeeting);
export default router;