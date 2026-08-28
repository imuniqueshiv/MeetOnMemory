import express from "express";
import {
  startRecordingSession,
  recordChunk,
  updateSessionStatus,
  getRecordingSessionMetrics,
  getStuckSessions,
  resolveStuckSession,
} from "../controllers/recordingSessionController.js";
import protect from "../middleware/userAuth.js";

const router = express.Router();

router.use(protect);

router.post("/start", startRecordingSession);
router.post("/:sessionId/chunk", recordChunk);
router.post("/:sessionId/status", updateSessionStatus);
router.get("/metrics", getRecordingSessionMetrics);
router.get("/stuck", getStuckSessions);
router.patch("/:sessionId/resolve-stuck", resolveStuckSession);

export default router;
