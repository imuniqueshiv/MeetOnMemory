import express from "express";
import userAuth from "../middleware/userAuth.js";
import { verifyMeetingAccess } from "../middleware/meetingAuth.js";
import {
  getChapters,
  generateChapters,
  addChapter,
  updateChapter,
  deleteChapter,
} from "../controllers/transcriptChapterController.js";

const router = express.Router({ mergeParams: true });

// All routes are scoped under /api/meetings/:meetingId/chapters
// We expect the main router to apply the auth and meeting access middleware,
// but we can also add them here if needed.

router.use(userAuth);
router.use(verifyMeetingAccess);

router.get("/", getChapters);
router.post("/generate", generateChapters);
router.post("/", addChapter);
router.put("/:chapterId", updateChapter);
router.delete("/:chapterId", deleteChapter);

export default router;
