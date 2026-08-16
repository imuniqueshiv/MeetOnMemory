import express from "express";
import { getDuplicateCandidates, mergeMeetings } from "../controllers/meetingMergeController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply auth middleware if your app requires it (assuming basic authenticate is available)
// The issue doesn't specify auth middleware explicitly but requires req.user
router.use(authenticate || ((req, res, next) => next()));

router.get("/duplicates", getDuplicateCandidates);
router.post("/merge", mergeMeetings);

export default router;
