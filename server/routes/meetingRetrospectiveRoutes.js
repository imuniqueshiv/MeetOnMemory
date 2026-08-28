import express from "express";
import {
  getRetrospective,
  submitRetrospective,
  upvoteItem,
  generateAiThemes,
} from "../controllers/meetingRetrospectiveController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/:meetingId").get(protect, getRetrospective);
router.route("/:meetingId/submissions").post(protect, submitRetrospective);
router
  .route("/:meetingId/submissions/:submissionId/upvote")
  .post(protect, upvoteItem);
router.route("/:meetingId/ai-themes").post(protect, generateAiThemes);

export default router;
