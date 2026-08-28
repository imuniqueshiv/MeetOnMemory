import express from "express";
import {
  getQuestions,
  submitQuestion,
  toggleUpvote,
  updateStatus,
} from "../controllers/meetingQuestionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router
  .route("/meetings/:id/questions")
  .get(protect, getQuestions)
  .post(protect, submitQuestion);

router.route("/questions/:id/upvote").post(protect, toggleUpvote);

router.route("/questions/:id/status").put(protect, updateStatus);

export default router;
